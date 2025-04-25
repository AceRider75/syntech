// landing.js - Handles redirection from the landing page

document.addEventListener('DOMContentLoaded', () => {
    const loginNav = document.getElementById('loginBtnNav');
    const signupNav = document.getElementById('signupBtnNav');
    const getStarted = document.getElementById('getStartedBtn');
    const signupBottom = document.getElementById('signupBtnBottom');

    // IMPORTANT: Set this to the filename of your main app/login HTML file
    const appLoginPageUrl = 'app.html';

    function redirectToAppLogin(event) {
        console.log(`Button clicked: ${event.target.id || 'Unknown'}, redirecting to ${appLoginPageUrl}`);
        window.location.href = appLoginPageUrl;
    }

    // Attach the same redirect function to all relevant buttons
    if (loginNav) loginNav.addEventListener('click', redirectToAppLogin);
    if (signupNav) signupNav.addEventListener('click', redirectToAppLogin);
    if (getStarted) getStarted.addEventListener('click', redirectToAppLogin);
    if (signupBottom) signupBottom.addEventListener('click', redirectToAppLogin);

    console.log("Landing page redirection listeners attached.");
});
