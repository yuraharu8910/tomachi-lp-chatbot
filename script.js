// ==========================================================
// とおまち夏花火ナイト LP スクリプト
// このファイルがやっていることは大きく6つです
//   1. 吹き出し・数字カード・一日の流れ等（.bubble-in / .reveal-in）が
//      画面に入ったらフワッと表示する
//   2. 動画の再生/一時停止に合わせて、中央の再生ボタンを出し入れする
//   3. 横スクロールカード列（.scroll-row）が画面に入ったら自動でスクロールする
//   4. FVを過ぎたら、画面下に固定CTAバーを表示する
//   5. 「予約する」ボタンで、観覧席予約のポップアップフォームを開閉する
//   6. FAQの開閉をなめらかにアニメーションさせる
// ==========================================================

document.addEventListener('DOMContentLoaded', function () {

  // ---- 1. スクロール連動で、吹き出し・数字カード・一日の流れ等をフワッと表示 ----
  // IntersectionObserver は「その要素が画面内に入ったかどうか」を
  // 監視してくれるブラウザ標準の仕組みです。
  // .bubble-in（悩みセクションの吹き出し）と .reveal-in（数字カード・一日の流れの
  // ステップなど）は、どちらも同じ「フワッと表示」の仕組みを共有しているので、
  // まとめて1つのIntersectionObserverで監視しています。
  var bubbles = document.querySelectorAll('.bubble-in, .reveal-in');

  if ('IntersectionObserver' in window && bubbles.length > 0) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible'); // style.css 側のアニメーションが発動
          io.unobserve(entry.target); // 一度表示したら監視を終了（毎回アニメーションしないように）
        }
      });
    }, { threshold: 0.3 }); // 要素の3割が見えたら発火

    bubbles.forEach(function (el) {
      io.observe(el);
    });
  } else {
    // 古いブラウザでIntersectionObserverが使えない場合は、最初から表示しておく
    bubbles.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ---- 2. 動画の再生ボタン（プレイヒント）の出し入れ ----
  var video = document.getElementById('solution-video');
  var hint = document.getElementById('solution-video-playhint');

  if (video && hint) {
    video.addEventListener('play', function () {
      hint.style.display = 'none'; // 再生が始まったらボタンを隠す
    });
    video.addEventListener('pause', function () {
      hint.style.display = 'flex'; // 一時停止したらボタンを再表示
    });
  }

  // ---- 3. 横スクロールカード列（来場シーン／宿泊／来場者の声）の自動スクロール ----
  // 「少しずつ流れる」動きではなく、「1枚ずつスッとスライドして止まる」動きにしています。
  var scrollRows = document.querySelectorAll('.scroll-row');

  scrollRows.forEach(function (row) {
    var interval = 2800;   // 何ミリ秒ごとに次のカードへ進むか
    var isPaused = false;  // ユーザーが指で触っている間はtrueにする
    var timerId = null;    // setInterval のID（動いているかどうかの目印にも使う）
    var currentIndex = 0;  // 今何枚目のカードが表示されているか

    // 子要素（カード）を配列として取得しておく
    var cards = Array.prototype.slice.call(row.children);

    // 現在のスクロール位置から一番近いカードのインデックスを逆算する
    // （ユーザーが手で動かした後、続きから自動再生を再開するために使う）
    function findClosestIndex() {
      var closest = 0;
      var minDiff = Infinity;
      cards.forEach(function (card, i) {
        var diff = Math.abs(card.offsetLeft - row.scrollLeft);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      });
      return closest;
    }

    // イージング関数（動きの緩急のカーブ）
    // 最初と最後がゆっくり、真ん中が速い「ふわっ」とした動きになります
    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // scroll-snap（カードの位置でピタッと止まる機能）が有効なままだと、
    // アニメーション中もブラウザが裏で位置を補正しようとして、カクつきの原因になります。
    // なので、自動でスライドしている間だけ scroll-snap-type を無効にします。
    function disableSnap() {
      row.style.scrollSnapType = 'none';
    }
    function enableSnap() {
      row.style.scrollSnapType = 'x proximity';
    }

    // ブラウザ任せの scrollTo({behavior:'smooth'}) は動きが速すぎたり
    // カクついたりすることがあるため、自前でアニメーションさせています
    var scrollRafId = null; // 実行中のアニメーションのID（二重に動かさないためのガード）

    function smoothScrollTo(targetLeft, duration) {
      // 前のアニメーションがまだ終わっていなければ、確実に止めてから新しく始める
      // （これが無いと、タイミングによっては2つのアニメーションが同時に動いて
      //   位置がぶつかり合い、一気に最後までスライドしたように見えることがあります）
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = null;
      }

      disableSnap();
      var startLeft = row.scrollLeft;
      var distance = targetLeft - startLeft;
      var startTime = null;

      function frame(now) {
        if (startTime === null) startTime = now;
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1); // 0〜1の進行度
        row.scrollLeft = startLeft + distance * easeInOutCubic(progress);
        if (progress < 1) {
          scrollRafId = requestAnimationFrame(frame);
        } else {
          scrollRafId = null;
          enableSnap(); // アニメーションが終わったら、手動スワイプ用にスナップを元に戻す
        }
      }
      scrollRafId = requestAnimationFrame(frame);
    }

    // 次のカードへ、ふわっと（滑らかに）スクロールする
    var isGoingNext = false; // goToNext自体が二重に呼ばれるのを防ぐガード

    function goToNext() {
      if (isGoingNext) return; // 前の呼び出しの処理中は何もしない
      isGoingNext = true;
      currentIndex = (currentIndex + 1) % cards.length; // 最後まで行ったら先頭に戻る
      smoothScrollTo(cards[currentIndex].offsetLeft, 700); // 700ミリ秒かけてゆっくり移動
      setTimeout(function () {
        isGoingNext = false;
      }, 720); // アニメーション時間(700ms)より少し長めに待ってから解除する
    }

    function startAutoScroll() {
      if (timerId === null) {
        timerId = setInterval(function () {
          if (!isPaused) {
            goToNext();
          }
        }, interval);
      }
    }
    function stopAutoScroll() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    // 画面に入ったら自動スクロール開始、画面外に出たら停止（無駄な処理をしないため）
    if ('IntersectionObserver' in window) {
      var rowObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            startAutoScroll();
          } else {
            stopAutoScroll();
          }
        });
      }, { threshold: 0.3 });
      rowObserver.observe(row);
    } else {
      startAutoScroll();
    }

    // ユーザーが指（またはマウス）で触っている間は自動スクロールを止める
    ['touchstart', 'mousedown'].forEach(function (evt) {
      row.addEventListener(evt, function () {
        isPaused = true;
      });
    });
    // 触るのをやめたら、少し間を置いてから、今いる位置の続きから自動再生を再開する
    ['touchend', 'mouseup', 'mouseleave'].forEach(function (evt) {
      row.addEventListener(evt, function () {
        setTimeout(function () {
          currentIndex = findClosestIndex();
          isPaused = false;
        }, 1500);
      });
    });
  });

  // ---- 4. FVと最終CTAセクションを過ぎている間だけ、画面下に固定CTAバーを表示する ----
  // FV／最終CTAセクション自身にも同じ内容のボタンがあるため、
  // どちらかが画面に見えている間は固定バーを隠して「CTAの二重表示」を防ぎます。
  var fv = document.querySelector('.fv');
  var finalCta = document.querySelector('.section--cta');
  var stickyCta = document.getElementById('sticky-cta');

  if (stickyCta && (fv || finalCta)) {
    var fvVisible = false;
    var finalCtaVisible = false;

    // fvVisible・finalCtaVisible の状態から、固定バーの表示/非表示を決める
    function updateStickyCta() {
      if (!fvVisible && !finalCtaVisible) {
        stickyCta.classList.add('is-visible');
      } else {
        stickyCta.classList.remove('is-visible');
      }
    }

    if ('IntersectionObserver' in window) {
      if (fv) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            fvVisible = entry.isIntersecting;
            updateStickyCta();
          });
        }, { threshold: 0 }).observe(fv);
      }
      if (finalCta) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            finalCtaVisible = entry.isIntersecting;
            updateStickyCta();
          });
        }, { threshold: 0 }).observe(finalCta);
      }
    } else {
      // 古いブラウザでは常に表示しておく
      stickyCta.classList.add('is-visible');
    }
  }

  // ---- 5. 観覧席予約のポップアップフォームの開閉・送信 ----
  var modal = document.getElementById('reservation-modal');
  var reservationForm = document.getElementById('reservation-form');

  if (modal && reservationForm) {
    // 「観覧席を予約する」系のボタン（js-open-reservationクラス）を
    // 全部まとめて取得し、クリックされたらポップアップを開く
    document.querySelectorAll('.js-open-reservation').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); // <a>タグのページ内リンク移動を止める
        modal.showModal();  // <dialog>を「モーダル」として開く（背景も自動で暗くなる）
      });
    });

    // ×ボタン・完了画面の「閉じる」ボタン（data-close-modal）で閉じる
    modal.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modal.close();
      });
    });

    // 背景（暗い部分）をクリックしたら閉じる。
    // dialog要素そのものがクリックされた時だけ「背景がクリックされた」とみなす
    // （フォームの中をクリックした時は、中の要素がターゲットになるのでここには来ない）
    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.close();
      }
    });

    // フォーム送信時の処理
    // TODO: 現状は見た目だけの動作確認用です。実際に送信できるようにするには、
    //       下記のPOST送信部分を、用意した送信先（Googleフォーム／Formspree等）に
    //       あわせて書き換えてください。
    reservationForm.addEventListener('submit', function (e) {
      e.preventDefault(); // 今はページ遷移・実送信をせず、完了メッセージだけ表示する

      // 入力欄と送信ボタンをまとめて隠し、完了メッセージだけ見せる
      Array.prototype.forEach.call(reservationForm.children, function (child) {
        if (!child.classList.contains('reservation-modal__success') &&
          !child.hasAttribute('data-close-modal')) {
          child.style.display = 'none';
        }
      });
      var success = reservationForm.querySelector('.reservation-modal__success');
      if (success) {
        success.hidden = false;
      }
    });

    // 閉じた時に、次に開いた時のためにフォームの状態を元に戻す
    modal.addEventListener('close', function () {
      reservationForm.reset();
      Array.prototype.forEach.call(reservationForm.children, function (child) {
        if (!child.classList.contains('reservation-modal__success') &&
          !child.hasAttribute('data-close-modal')) {
          child.style.display = '';
        }
      });
      var success = reservationForm.querySelector('.reservation-modal__success');
      if (success) {
        success.hidden = true;
      }
    });
  }

  // ---- 6. FAQの開閉をなめらかにする ----
  // <details>のネイティブな開閉は一瞬で切り替わってしまうため、
  // クリックをJSで受け取って、中身（.faq__panel）の max-height を
  // 自分でアニメーションさせています。
  document.querySelectorAll('.faq').forEach(function (details) {
    var summary = details.querySelector('summary');
    var panel = details.querySelector('.faq__panel');
    if (!summary || !panel) return;

    summary.addEventListener('click', function (e) {
      e.preventDefault(); // ネイティブの瞬間開閉を止めて、自分でアニメーションさせる

      if (details.open) {
        // ---- 閉じる ----
        // 今の高さを一度はっきり指定してから0にすることで、
        // 「開いた状態→閉じた状態」への滑らかな変化にする
        panel.style.maxHeight = panel.scrollHeight + 'px';
        requestAnimationFrame(function () {
          panel.style.maxHeight = '0px';
        });
        panel.addEventListener('transitionend', function handler() {
          details.open = false; // アニメーションが終わってから<details>を閉じ状態にする
          panel.removeEventListener('transitionend', handler);
        });
      } else {
        // ---- 開く ----
        details.open = true; // 先に開いた状態にしないと中身の高さが測れない
        panel.style.maxHeight = panel.scrollHeight + 'px';
        panel.addEventListener('transitionend', function handler() {
          panel.style.maxHeight = 'none'; // 開いた後は高さ制限を外しておく（文字サイズ変更等に強くするため）
          panel.removeEventListener('transitionend', handler);
        });
      }
    });
  });

});

/* ===================================================
   FVの背景動画クロスフェード
   ①とおま → ②花火 → ③商店街 の順に再生し、
   1本が終わるたびにopacityを入れ替えてふわっと切り替え、
   これを無限にループさせます
=================================================== */
(function () {
  const videoA = document.getElementById('fvBgVideoA'); // とおま
  const videoB = document.getElementById('fvBgVideoB'); // 花火
  const videoC = document.getElementById('fvBgVideoC'); // 商店街
  if (!videoA || !videoB || !videoC) return; // FVがないページでは何もしない（安全対策）

  const videos = [videoA, videoB, videoC]; // ← ここに3本並べるだけで本数を増減できます
  let currentIndex = 0; // 今表示中の動画のインデックス

  function crossfadeToNext() {
    const current = videos[currentIndex];
    const nextIndex = (currentIndex + 1) % videos.length; // 最後まで来たら0（先頭）に戻る
    const next = videos[nextIndex];

    next.currentTime = 0;   // 次の動画を頭出し
    next.play().catch(() => { }); // 自動再生がブロックされた時のエラーは無視

    current.classList.remove('is-active'); // 今の動画をopacity:0へ
    next.classList.add('is-active');       // 次の動画をopacity:1へ（ここでクロスフェード発生）

    currentIndex = nextIndex;
  }

  // 各動画は「最後まで再生し終わったら」次へバトンタッチする
  videos.forEach((video) => {
    video.addEventListener('ended', crossfadeToNext);
  });
})();

/* ===================================================
   FVの背景動画＋タイトル文字のクロスフェード
   ①とおま → ②花火 → ③商店街 の順に、
   動画とタイトル文字を同時にふわっと切り替えながら
   無限にループさせます
=================================================== */
(function () {
  const videoA = document.getElementById('fvBgVideoA'); // とおま
  const videoB = document.getElementById('fvBgVideoB'); // 花火
  const videoC = document.getElementById('fvBgVideoC'); // 商店街
  const inner = document.getElementById('fvInner');      // タイトル文字全体を囲むdiv
  const kickerEl = document.getElementById('fvKicker');
  const titleEl = document.getElementById('fvTitle');
  const leadEl = document.getElementById('fvLead');

  if (!videoA || !videoB || !videoC || !inner) return; // 要素が無いページでは何もしない（安全対策）

  const videos = [videoA, videoB, videoC];

  // 動画ごとに表示したいコピー（kicker=小見出し／title=大見出し／lead=説明文）
  // titleとleadは<br>やアクセント文字色<span>を使いたいのでinnerHTMLで差し込みます
  const slides = [
    {
      // ① とおま（マスコット紹介・導入）
      kicker: 'とおまち観光協会 presents',
      title: 'とおまち<br>夏花火<span class="fv__title-accent">ナイト</span>。',
      lead: '気合いを入れすぎなくていい、<br>ふらっと寄れる夏の特別。<br>3,000発の花火｜8月中旬の土曜 開催'
    },
    {
      // ② 花火（迫力・観覧の魅力）
      // 見出し2行目は①の「夏花火ナイト。」と同じ7文字に揃えることで、
      // 同じ画面幅・同じ文字サイズでも2行に収まるようにしています
      kicker: '川沿いで見る、3,000発',
      title: '顔に届く<br>くらいの<span class="fv__title-accent">迫力</span><span class="fv__title-nowrap">を</span>',
      lead: '混雑は激しくない、ちょうどいい特等席。<br>終わってもすぐ電車に乗れる近さです'
    },
    {
      // ③ 商店街（食べ歩き・夜のそぞろ歩き）
      // こちらも2行目を7文字に調整
      kicker: '夕方から、ふらっと',
      title: '商店街で<br><span class="fv__title-accent">食べ歩き</span><span class="fv__title-nowrap">する夏</span>',
      lead: '提灯の灯る夜道を歩くだけで、<br>もう夏の思い出に。<br>気づいたら花火の時間です'
    }
  ];

  let currentIndex = 0; // 今表示中の動画・文字のインデックス

  // slides配列の中身を、実際のHTML要素に反映する関数
  function applySlideText(index) {
    const slide = slides[index];
    kickerEl.textContent = slide.kicker; // 記号やタグを含まないので textContent でOK
    titleEl.innerHTML = slide.title;     // <br>や<span>を使うため innerHTML
    leadEl.innerHTML = slide.lead;
  }

  function crossfadeToNext() {
    const current = videos[currentIndex];
    const nextIndex = (currentIndex + 1) % videos.length; // 最後まで来たら0（先頭）に戻る
    const next = videos[nextIndex];

    // ---- 動画側のクロスフェード ----
    next.currentTime = 0;        // 次の動画を頭出し
    next.play().catch(() => { }); // 自動再生がブロックされた時のエラーは無視
    current.classList.remove('is-active');
    next.classList.add('is-active');

    // ---- 文字側のクロスフェード ----
    inner.classList.add('is-fading'); // まず文字をopacity:0にする（CSSのtransitionで0.5秒かけて消える）

    // CSSのtransition時間（0.5秒＝500ms）と同じだけ待ってから中身を差し替え、
    // その後 is-fading を外して再度ふわっと表示させる
    setTimeout(() => {
      applySlideText(nextIndex);
      inner.classList.remove('is-fading');
    }, 500);

    currentIndex = nextIndex;
  }

  // 各動画は「最後まで再生し終わったら」次へバトンタッチする
  videos.forEach((video) => {
    video.addEventListener('ended', crossfadeToNext);
  });
})();