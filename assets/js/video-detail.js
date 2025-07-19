document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const personTab = document.getElementById('person-tab');
    const aiTab = document.getElementById('ai-tab');
    const personComments = document.getElementById('person-comments');
    const aiComments = document.getElementById('ai-comments');
    
    personTab.addEventListener('click', function() {
        personTab.classList.add('active');
        aiTab.classList.remove('active');
        personComments.classList.add('active');
        aiComments.classList.remove('active');
    });
    
    aiTab.addEventListener('click', function() {
        aiTab.classList.add('active');
        personTab.classList.remove('active');
        aiComments.classList.add('active');
        personComments.classList.remove('active');
    });
    
    // Reply modal functionality
    const replyModal = document.getElementById('reply-modal');
    const replyTextarea = document.getElementById('reply-textarea');
    const sendReplyBtn = document.querySelector('.send-reply-btn');
    const successModal = document.getElementById('success-modal');
    
    // Open reply modal
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const commentItem = this.closest('.comment-item');
            const commentText = commentItem.querySelector('.comment-text').textContent;
            const commentTime = commentItem.querySelector('.comment-time').textContent;
            
            document.getElementById('modal-text').textContent = commentText;
            document.getElementById('modal-time').textContent = commentTime;
            
            replyModal.style.display = 'flex';
            replyTextarea.focus();
        });
    });
    
    // Close modal when clicking outside
    replyModal.addEventListener('click', function(e) {
        if (e.target === replyModal) {
            replyModal.style.display = 'none';
            replyTextarea.value = '';
        }
    });
    
    // Send reply
    sendReplyBtn.addEventListener('click', function() {
        if (replyTextarea.value.trim()) {
            replyModal.style.display = 'none';
            successModal.style.display = 'block';
            
            setTimeout(() => {
                successModal.style.display = 'none';
                replyTextarea.value = '';
            }, 2000);
        }
    });
    
    // AI reply send buttons
    document.querySelectorAll('.send-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            successModal.style.display = 'block';
            
            setTimeout(() => {
                successModal.style.display = 'none';
            }, 2000);
        });
    });
});