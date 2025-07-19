document.addEventListener('DOMContentLoaded', function() {
    const signinForm = document.getElementById('signin-form');
    
    if (signinForm) {
        signinForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            localStorage.setItem('isLoggedIn', 'true');
            
            window.location.href = 'home.html';
        });
    }
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            const isLoggedIn = localStorage.getItem('isLoggedIn');
            
            if (!isLoggedIn && this.getAttribute('href') !== 'index.html') {
                e.preventDefault();
                window.location.href = 'signin.html';
            }
        });
    });
    
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'index.html' && currentPage !== 'signin.html' && !localStorage.getItem('isLoggedIn')) {
        window.location.href = 'signin.html';
    }
    
    const videoItems = document.querySelectorAll('.video-item');
    videoItems.forEach(item => {
        item.addEventListener('click', function() {
            window.location.href = 'video-detail.html';
        });
    });
    
    const messageItems = document.querySelectorAll('.message-item');
    messageItems.forEach(item => {
        item.addEventListener('click', function() {
            alert('メッセージ詳細は現在準備中です');
        });
    });
    
    const notificationItems = document.querySelectorAll('.notification-item');
    notificationItems.forEach(item => {
        item.addEventListener('click', function() {
            alert('通知詳細は現在準備中です');
        });
    });
    
    const logoutBtn = document.querySelector('.btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('ログアウトしますか？')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
                window.location.href = 'signin.html';
            }
        });
    }
    
    const settingsLogoutItem = document.querySelector('.settings-item');
    if (settingsLogoutItem && settingsLogoutItem.textContent.includes('ログアウト')) {
        settingsLogoutItem.addEventListener('click', function() {
            if (confirm('ログアウトしますか？')) {
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
                window.location.href = 'signin.html';
            }
        });
    }
});