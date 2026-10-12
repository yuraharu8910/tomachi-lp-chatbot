/* ============================================================
   チャットボット UI 制御 (段階3: Claude API連携)
   ------------------------------------------------------------
   ・開閉処理は段階1から変更なし。
   ・回答ロジックを「Google Sheetsのキーワード一致」から
     「Google Sheetsの内容をもとにしたAI(Claude API)回答」に
     置き換えた。
   ・仕組み:
     1. ページを開いたら、Google Sheets(CSV)から
        Q&Aナレッジを読み込む
     2. ナレッジを「システムプロンプト」という文章にまとめる
        (AIに「この情報の範囲内だけで答えてね」と指示する文章)
     3. ユーザーが質問を送ったら、バックエンド(Railway)の
        /chat にシステムプロンプトと質問を送る
     4. バックエンドがClaude APIを呼び出し、回答を返してくれる
        (APIキーはバックエンドだけが持っていて、ここには出てこない)
   ============================================================ */

/* ---- 0. 設定 ---------------------------------------------------
   ↓ 2つとも、必ず自分の値に書き換えてから公開してください。
------------------------------------------------------------- */

// あなたが公開した「段階3用」スプレッドシートのCSV URL。
// (「ファイル」→「共有」→「ウェブに公開」→CSV形式を選択 で発行されるURLです)
var KNOWLEDGE_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRQdVZPhn3e8z6mzVIvVCl1Iih5sPl6wRmmAcbY74bOIrQKbO2ZlV44PITXB8tZMFkxgYldqABZ9iKm/pub?gid=626182984&single=true&output=csv';

// バックエンド（AIに質問を渡すサーバー）のURL。
// 2026年10月：Railwayの無料お試し期間が終わったため、無料のGoogle Apps Script(GAS)に引っ越し。
// GASを「ウェブアプリ」として公開したURL（https://script.google.com/macros/s/…/exec）を入れる。
// （旧：'https://tomachi-chatbot-backend-production.up.railway.app/chat'）
var BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwEOBkj9vijILkKcTFssGcgRHRYpQdumZdpO8Fg-q-QYn_0b-Ach0WADCQ0FSCdpL1P/exec';

document.addEventListener('DOMContentLoaded', function () {

  /* ---- 1. 要素の取得 ------------------------------------------ */
  var triggerButton = document.getElementById('chatbot-trigger');
  var chatWindow = document.getElementById('chatbot-window');
  var closeButton = document.getElementById('chatbot-close');
  var chatForm = document.getElementById('chatbot-form');
  var chatInput = document.getElementById('chatbot-input');
  var chatLog = document.getElementById('chatbot-log');
  var sendButton = chatForm ? chatForm.querySelector('.chatbot__send') : null;
  var greeting = document.getElementById('chatbot-greeting'); // 「質問はこちらから」の吹き出し

  // 該当要素が無いページでは何もしない(安全対策)
  if (!triggerButton || !chatWindow || !chatForm) {
    return;
  }

  // 挨拶の吹き出しを即座に隠す(チャットを開いたタイミングで呼ぶ)。
  // 自動フェードアウト(CSSアニメーション)を待たずに消したい場合に使う。
  function dismissGreeting() {
    if (greeting) {
      greeting.classList.add('is-dismissed');
    }
  }

  /* ---- 2. 開閉処理(段階1と同じ) --------------------------------- */

  function openChat() {
    chatWindow.classList.add('is-open');
    triggerButton.classList.add('is-open');
    triggerButton.setAttribute('aria-expanded', 'true');
    chatWindow.setAttribute('aria-hidden', 'false');
    triggerButton.setAttribute('aria-label', 'チャットを閉じる');
    dismissGreeting(); // チャットを開いたら、挨拶の吹き出しはもう不要なので消す
    window.setTimeout(function () {
      chatInput.focus();
    }, 200);
  }

  function closeChat() {
    chatWindow.classList.remove('is-open');
    triggerButton.classList.remove('is-open');
    triggerButton.setAttribute('aria-expanded', 'false');
    chatWindow.setAttribute('aria-hidden', 'true');
    triggerButton.setAttribute('aria-label', 'チャットを開く');
  }

  function toggleChat() {
    if (chatWindow.classList.contains('is-open')) {
      closeChat();
    } else {
      openChat();
    }
  }

  triggerButton.addEventListener('click', function () {
    toggleChat();
  });

  if (closeButton) {
    closeButton.addEventListener('click', function () {
      closeChat();
    });
  }

  document.addEventListener('click', function (event) {
    if (!chatWindow.classList.contains('is-open')) {
      return;
    }
    if (!event.target.closest('.chatbot')) {
      closeChat();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (chatWindow.classList.contains('is-open') && event.key === 'Escape') {
      closeChat();
      triggerButton.focus();
    }
  });

  /* ---- 3. 会話ログへの吹き出し追加 ------------------------------- */

  function addBubble(text, sender) {
    // sender は 'user' か 'bot' を想定
    var bubble = document.createElement('div');
    bubble.className = 'chatbot__bubble chatbot__bubble--' + sender;
    bubble.textContent = text;
    chatLog.appendChild(bubble);
    chatLog.scrollTop = chatLog.scrollHeight;
    return bubble;
  }

  /* ---- 4. Google Sheets(CSV)からナレッジを取得し、
             AIへの指示文(システムプロンプト)を組み立てる ----------
     fetch は「通信が終わるまで待つ」非同期処理。ページを開いた瞬間に
     1回だけ取得を始め、その結果(Promise)を変数に保存しておく。
     フォーム送信のたびに毎回Sheetsへ取りに行くと遅くなる/無駄が
     多いため、使い回す設計にしている。
  ------------------------------------------------------------- */

  // knowledgePromiseの中身は { systemPrompt, errorMessage } という形に統一する。
  // errorMessageがnull以外のときは「設定ミス」を意味し、送信時に
  // ユーザー(=開発中のあなた自身)へそのまま表示して気づけるようにする。
  var knowledgePromise = loadKnowledge().then(function (result) {
    if (result.errorMessage) {
      return { systemPrompt: null, errorMessage: result.errorMessage };
    }
    return { systemPrompt: buildSystemPrompt(result.data), errorMessage: null };
  });

  function loadKnowledge() {
    // CSV URLが未設定のままだと、ここで分かりやすいエラーを出す
    if (!KNOWLEDGE_CSV_URL || KNOWLEDGE_CSV_URL.indexOf('http') !== 0) {
      var msg = 'KNOWLEDGE_CSV_URL が未設定です。chatbot.js の先頭を確認してください。';
      console.warn(msg);
      return Promise.resolve({ data: [], errorMessage: msg });
    }

    return fetch(KNOWLEDGE_CSV_URL)
      .then(function (res) {
        if (!res.ok) {
          // HTTPエラー(404など)は、ここで例外として投げてcatchに渡す
          throw new Error('Sheetsの取得に失敗しました(status: ' + res.status + ')');
        }
        return res.text();
      })
      .then(function (csvText) {
        var parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        var fields = (parsed.meta && parsed.meta.fields) || [];

        // ここが重要な安全チェック: 「共有」ボタンのリンク(HTMLページ)を
        // 誤って貼ってしまった場合、fetchは成功してもCSVとしての中身が
        // 正しくない(question/answer列が存在しない)。ここで検出して、
        // 原因がひと目でわかるメッセージにする。
        if (fields.indexOf('question') === -1 || fields.indexOf('answer') === -1) {
          throw new Error(
            'CSVの形式が正しくありません(question/answer列が見つかりません)。' +
            'URLが「ウェブに公開」で発行したCSV用URLになっているか確認してください。' +
            '「共有」ボタンのリンクはCSVではないため使えません。'
          );
        }

        return { data: parsed.data, errorMessage: null }; // [{category, question, answer, priority}, ...]
      })
      .catch(function (error) {
        // 通信エラー・公開設定ミスなどはここでまとめて捕まえる。
        // アプリ全体を止めず、エラー内容を保持したまま返す。
        console.error('ナレッジの読み込みに失敗しました:', error);
        return { data: [], errorMessage: error.message };
      });
  }

  /* ---- 5. システムプロンプト(AIへの指示文)を組み立てる --------------
     ポイント: 「このナレッジの範囲内だけで答えて、無いことは答えない
     (=ハルシネーション防止)」と明示することが最重要。
     priority列(数字が小さいほど重要)があれば並び替えて、優先度の
     高い情報がAIの目に入りやすい先頭側に来るようにしている。
  ------------------------------------------------------------- */

  function buildSystemPrompt(knowledgeData) {
    // priorityが数字として読み取れる行を優先度順(昇順)に並び替える。
    // 数字が無い/読み取れない行は末尾に回す(999扱い)。
    var sorted = knowledgeData.slice().sort(function (a, b) {
      var pa = parseInt(a.priority, 10);
      var pb = parseInt(b.priority, 10);
      if (isNaN(pa)) pa = 999;
      if (isNaN(pb)) pb = 999;
      return pa - pb;
    });

    var knowledgeLines = sorted
      .filter(function (row) {
        return row.question && row.answer; // 空行は除外
      })
      .map(function (row) {
        var category = row.category ? '[' + row.category + '] ' : '';
        return '・' + category + 'Q: ' + row.question + ' / A: ' + row.answer;
      })
      .join('\n');

    // このテキスト全体が、Claude APIの「system」パラメータとして送られる。
    // 「ナレッジに無いことは答えない」という縛りが、根拠のない回答
    // (ハルシネーション)を防ぐ一番のポイント。
    return (
      'あなたは花火大会イベント「とおまち夏花火ナイト」の公式AIアシスタントです。\n' +
      '以下の【ナレッジ】に書かれている情報の範囲内だけで、来場者からの質問に' +
      '丁寧な敬語で簡潔に答えてください。\n\n' +
      '【回答のルール】\n' +
      '1. 【ナレッジ】に書かれていないことは、絶対に推測・創作しないでください。\n' +
      '2. 【ナレッジ】で答えられない質問には、' +
      '「申し訳ございません、その内容については担当者にお問い合わせください。」' +
      'とだけ答えてください。\n' +
      '3. 回答は2〜3文程度で、簡潔にまとめてください。\n\n' +
      '【ナレッジ】\n' +
      knowledgeLines
    );
  }

  /* ---- 6. バックエンド(Google Apps Script)経由でClaude APIに質問する ---- */

  function askAI(userInput, systemPrompt) {
    if (!BACKEND_URL || BACKEND_URL.indexOf('http') !== 0) {
      return Promise.resolve(
        '⚠️ BACKEND_URL が未設定です。chatbot.js の先頭を確認してください。'
      );
    }

    // GASには「質問」だけを送る。AIへの指示文（システムプロンプト）とナレッジは
    // GAS側で組み立てるので、LPから書き換えられることはない（安全のため）。
    // ※ Content-Type を text/plain にするのは、GASがブラウザの事前確認
    //   （プリフライト）に対応していないため。
    return fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ message: userInput }),
    })
      .then(function (res) {
        // バックエンドが用意しているエラーレスポンス(400/500/502など)は
        // res.ok が false になる。中身のerrorメッセージを取り出して使う。
        if (!res.ok) {
          return res.json().catch(function () {
            return {}; // レスポンスがJSONでない場合の保険
          }).then(function (body) {
            throw new Error(body.error || 'サーバーでエラーが発生しました(status: ' + res.status + ')');
          });
        }
        return res.json();
      })
      .then(function (body) {
        // GASはエラーでも「成功」として返すので、中身の error も確認する
        if (body.error) {
          throw new Error(body.error);
        }
        return body.reply || body.answer || '回答を取得できませんでした。';
      })
      .catch(function (error) {
        console.error('AIへの問い合わせに失敗しました:', error);
        return '⚠️ ' + error.message;
      });
  }

  /* ---- 7. フォーム送信処理 --------------------------------------- */

  chatForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var userText = chatInput.value.trim();
    if (userText === '') {
      return;
    }

    addBubble(userText, 'user');
    chatInput.value = '';

    // 連続送信での二重送信を防ぐため、送信中はボタンを無効化
    if (sendButton) {
      sendButton.disabled = true;
    }

    // 「考え中…」のような一時的な吹き出しを出しておき、
    // 回答が決まったら中身を差し替える
    var pendingBubble = addBubble('考え中…', 'bot');

    knowledgePromise
      .then(function (knowledge) {
        // ナレッジの読み込み自体に失敗している場合は、原因がわかる
        // メッセージをそのまま表示する(本番公開時はこの分岐が出ないのが正常)
        if (knowledge.errorMessage) {
          return '⚠️ ' + knowledge.errorMessage;
        }
        return askAI(userText, knowledge.systemPrompt);
      })
      .then(function (answer) {
        pendingBubble.textContent = answer;
        chatLog.scrollTop = chatLog.scrollHeight;
      })
      .catch(function (error) {
        // 念のための最終保険(通常はここまで到達しない)
        console.error('回答の生成中にエラーが発生しました:', error);
        pendingBubble.textContent = '申し訳ございません、エラーが発生しました。時間をおいて再度お試しください。';
      })
      .finally(function () {
        if (sendButton) {
          sendButton.disabled = false;
        }
      });
  });

});
