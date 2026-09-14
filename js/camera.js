/* カメラ起動、黒板を焼き込んだ写真の生成、CALS準拠の解像度・容量への圧縮 */
const CameraModule = (() => {
  let video, canvas, ctx, stream;

  // 参考写真の実測値を基準値とする（約123万画素、約350〜400KB/枚）
  const TARGET_MEGAPIXELS = 1_230_000;
  const TARGET_MIN_BYTES = 300 * 1024;
  const TARGET_MAX_BYTES = 420 * 1024;

  async function init() {
    video = document.getElementById('video');
    canvas = document.getElementById('captureCanvas');
    ctx = canvas.getContext('2d');

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      video.srcObject = stream;
    } catch (err) {
      Toast.show('カメラを起動できませんでした：' + err.message);
      console.error(err);
    }
  }

  // 表示上の座標（黒板のleft/top/width/height, wrap基準px）を
  // 実際のカメラ映像（ソース解像度）の座標に変換する（object-fit:coverのズレを補正）
  function mapOverlayToSource(overlayRect, wrapRect) {
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const wrapW = wrapRect.width;
    const wrapH = wrapRect.height;

    const scale = Math.max(wrapW / videoW, wrapH / videoH);
    const offsetX = (videoW * scale - wrapW) / 2;
    const offsetY = (videoH * scale - wrapH) / 2;

    return {
      left: (overlayRect.left + offsetX) / scale,
      top: (overlayRect.top + offsetY) / scale,
      width: overlayRect.width / scale,
      height: overlayRect.height / scale
    };
  }

  function computeTargetSize(videoW, videoH) {
    const aspect = videoW / videoH;
    let targetH = Math.sqrt(TARGET_MEGAPIXELS / aspect);
    let targetW = targetH * aspect;
    return { w: Math.round(targetW / 2) * 2, h: Math.round(targetH / 2) * 2 };
  }

  function drawBlackboardOnCanvas(rect, content) {
    const { left, top, width, height } = rect;
    ctx.save();
    ctx.fillStyle = '#16321f';
    ctx.fillRect(left, top, width, height);
    ctx.lineWidth = Math.max(2, width * 0.012);
    ctx.strokeStyle = '#f2e9d8';
    ctx.strokeRect(left, top, width, height);

    const pad = width * 0.04;
    const rows = [
      ['工事件名', content.koji || '－'],
      ['工種', content.koshu || '－'],
      ['測点', content.sokuten || '－'],
      ['撮影日', content.date || '－']
    ];
    const rowH = (height - pad * 2) / rows.length;
    const fontSize = Math.max(10, rowH * 0.5);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = 'middle';

    rows.forEach((row, i) => {
      const y = top + pad + rowH * i + rowH / 2;
      ctx.strokeStyle = 'rgba(253,248,236,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left + pad * 0.3, y - rowH / 2);
      ctx.lineTo(left + width - pad * 0.3, y - rowH / 2);
      ctx.stroke();

      ctx.fillStyle = '#ffe98a';
      ctx.fillText(row[0], left + pad, y, width * 0.32);
      ctx.fillStyle = '#fdf8ec';
      ctx.fillText(row[1], left + width * 0.36, y, width * 0.58);
    });
    ctx.restore();
  }

  async function encodeWithTargetSize(canvasEl) {
    // ファイルサイズが目安(300〜420KB)に収まるよう品質を調整しながらJPEG化
    let quality = 0.85;
    let blob = await new Promise(r => canvasEl.toBlob(r, 'image/jpeg', quality));
    let tries = 0;
    while (blob.size > TARGET_MAX_BYTES && quality > 0.3 && tries < 8) {
      quality -= 0.1;
      blob = await new Promise(r => canvasEl.toBlob(r, 'image/jpeg', quality));
      tries++;
    }
    return blob;
  }

  async function capture(blackboardVisible, blackboardContent, wrapRect) {
    if (!video.videoWidth) {
      Toast.show('カメラの準備中です。少し待って再度お試しください。');
      return null;
    }
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const target = computeTargetSize(videoW, videoH);

    canvas.width = target.w;
    canvas.height = target.h;
    ctx.drawImage(video, 0, 0, target.w, target.h);

    if (blackboardVisible) {
      const bbEl = Blackboard.getElement();
      const bbRect = {
        left: bbEl.offsetLeft, top: bbEl.offsetTop,
        width: bbEl.offsetWidth, height: bbEl.offsetHeight
      };
      const srcRect = mapOverlayToSource(bbRect, wrapRect);
      const scaleToTarget = target.w / videoW;
      const canvasRect = {
        left: srcRect.left * scaleToTarget,
        top: srcRect.top * scaleToTarget,
        width: srcRect.width * scaleToTarget,
        height: srcRect.height * scaleToTarget
      };
      drawBlackboardOnCanvas(canvasRect, blackboardContent);
    }

    const blob = await encodeWithTargetSize(canvas);
    return { blob, width: target.w, height: target.h };
  }

  return { init, capture };
})();
