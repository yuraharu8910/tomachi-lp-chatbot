/* ============================================================
   チャットボット UI 制御 (段階1: 開閉アニメーションのみ)
   ------------------------------------------------------------
   ・既存の script.js のコーディングスタイル(function式、
     2スペースインデント、日本語コメント)に合わせています。
   ・回答ロジック(Google Sheets連携・LLM API連携)は
     まだ実装していません。フォーム送信時は「準備中」の
     ダミー応答を返すだけの仮実装です(段階2・3で置き換えます)。
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---- 1. 要素の取得 ------------------------------------------ */
  var triggerButton = document.getElementById('chatbot-trigger');
  var chatWindow = document.getElementById('chatbot-window');
  var closeButton = document.getElementById('chatbot-close');
  var chatForm = document.getElementById('chatbot-form');
  var chatInput = document.getElementById('chatbot-input');
  var chatLog = document.getElementById('chatbot-log');

  // 該当要素が無いページでは何もしない(安全対策)
  if (!triggerButton || !chatWindow || !chatForm) {
    return;
  }

  /* ---- 2. 開閉処理 ---------------------------------------------- */

  function openChat() {
    chatWindow.classList.add('is-open');
    triggerButton.classList.add('is-open');
    triggerButton.setAttribute('aria-expanded', 'true');
    chatWindow.setAttribute('aria-hidden', 'false');
    triggerButton.setAttribute('aria-label', 'チャットを閉じる');

    // 開いたら入力欄にフォーカスして、すぐ質問を打てるようにする
    // (アニメーション中にフォーカスすると見た目がガクつくため少し遅らせる)
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
    var isOpen = chatWindow.classList.contains('is-open');
    if (isOpen) {
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

  // ウィンドウの外側(LP本体)をクリックしたら閉じる
  document.addEventListener('click', function (event) {
    var isOpen = chatWindow.classList.contains('is-open');
    if (!isOpen) {
      return;
    }
    var clickedInsideChat = event.target.closest('.chatbot');
    if (!clickedInsideChat) {
      closeChat();
    }
  });

  // Escキーでも閉じられるようにする(アクセシビリティ対応)
  document.addEventListener('keydown', function (event) {
    var isOpen = chatWindow.classList.contains('is-open');
    if (isOpen && event.key === 'Escape') {
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

    // 常に一番下(最新メッセージ)が見えるようにスクロール
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  /* ---- 4. フォーム送信(仮実装) ----------------------------------
     段階2でGoogle Sheetsのキーワード一致ロジックに、
     段階3でLLM API連携に、それぞれ置き換える部分です。
     今はUIの動作確認用に、入力をそのまま吹き出しに出し、
     ダミーの返信を返すだけにしています。
  ------------------------------------------------------------- */

  chatForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var userText = chatInput.value.trim();
    if (userText === '') {
      return;
    }

    addBubble(userText, 'user');
    chatInput.value = '';

    // TODO(段階2): ここでGoogle Sheetsのキーワード一致処理を呼ぶ
    // TODO(段階3): ここでRailway経由のLLM APIを呼ぶ
    window.setTimeout(function () {
      addBubble('(仮の返信です。回答ロジックは次の段階で実装します)', 'bot');
    }, 300);
  });

});
