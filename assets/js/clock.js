// リアルタイム時計の実装
function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    // 時刻を2桁で表示（例：09:41）
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    // すべてのページの時計を更新
    const timeElements = document.querySelectorAll('.time');
    timeElements.forEach(element => {
        element.textContent = timeString;
    });
}

// ページ読み込み時に時計を開始
document.addEventListener('DOMContentLoaded', function() {
    // 即座に時間を更新
    updateClock();
    
    // 1秒ごとに時間を更新
    setInterval(updateClock, 1000);
});

// グローバルに公開（他のページでも使用可能）
window.updateClock = updateClock;