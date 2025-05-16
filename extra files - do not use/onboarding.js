// /**
//  * Loyalty Program Auto-Enroll Extension - Onboarding Script
//  * Handles the onboarding experience for new users
//  */

// document.addEventListener('DOMContentLoaded', function () {
//     // DOM Elements
//     const steps = document.querySelectorAll('.step');
//     const progressDots = document.querySelectorAll('.progress-dot');
//     const nextButtons = document.querySelectorAll('.next-button');
//     const setupProfileButton = document.querySelector('.setup-profile-button');
//     const profileForm = document.getElementById('profile-form');
//     const saveProfileButton = document.getElementById('save-profile');
//     const finishButton = document.querySelector('.finish-button');

//     // Handle step navigation
//     nextButtons.forEach(button => {
//         button.addEventListener('click', () => {
//             const targetStep = button.getAttribute('data-goto');
//             showStep(targetStep);
//         });
//     });

//     // Show profile form when setup button is clicked
//     if (setupProfileButton) {
//         setupProfileButton.addEventListener('click', () => {
//             profileForm.style.display = 'block';
//             setupProfileButton.style.display = 'none';
//         });
//     }

//     // Handle profile saving
//     if (saveProfileButton) {
//         saveProfileButton.addEventListener('click', saveProfile);
//     }

//     // Handle completion
//     if (finishButton) {
//         finishButton.addEventListener('click', finishOnboarding);
//     }

//     // Check if a profile already exists
//     checkForExistingProfile();

//     /**
//      * Show a specific step in the onboarding process
//      * @param {string} stepNumber - Step number to show
//      */
//     function showStep(stepNumber) {
//         // Hide all steps
//         steps.forEach(step => {
//             step.style.display = 'none';
//         });

//         // Show target step
//         const targetStep = document.getElementById(`step-${stepNumber}`);
//         if (targetStep) {
//             targetStep.style.display = 'block';
//         }

//         // Update progress indicator
//         progressDots.forEach(dot => {
//             dot.classList.remove('active');
//             if (dot.getAttribute('data-step') <= stepNumber) {
//                 dot.classList.add('active');
//             }
//         });
//     }

//     /**
//      * Save user profile to storage
//      */
//     function saveProfile() {
//         const profileName = document.getElementById('profile-name').value.trim();
//         const firstName = document.getElementById('first-name').value.trim();
//         const lastName = document.getElementById('last-name').value.trim();
//         const email = document.getElementById('email').value.trim();
//         const birthday = document.getElementById('birthday').value;
//         const phone = document.getElementById('phone').value.trim();
//         const address = document.getElementById('address').value.trim();

//         // Validate required fields
//         if (!profileName || !firstName || !lastName || !email) {
//             alert('Please fill in all required fields (Profile Name, First Name, Last Name, Email)');
//             return;
//         }

//         // Create profile object
//         const profile = {
//             firstName,
//             lastName,
//             email,
//             birthday,
//             phone,
//             address
//         };

//         // Get existing profiles or create new profiles object
//         chrome.storage.sync.get('profiles', (data) => {
//             const profiles = data.profiles || {};

//             // Add new profile
//             profiles[profileName] = profile;

//             // Save to storage
//             chrome.storage.sync.set({
//                 profiles: profiles,
//                 activeProfile: profileName  // Set as active profile
//             }, () => {
//                 // Show success message
//                 alert('Profile saved successfully!');

//                 // Hide form and show button
//                 profileForm.style.display = 'none';
//                 setupProfileButton.style.display = 'inline-block';
//                 setupProfileButton.textContent = 'Edit Profile';

//                 // Move to next step
//                 showStep('3');
//             });
//         });
//     }

//     /**
//      * Check if user already has profiles set up
//      */
//     function checkForExistingProfile() {
//         chrome.storage.sync.get('profiles', (data) => {
//             if (data.profiles && Object.keys(data.profiles).length > 0) {
//                 // User already has profiles
//                 setupProfileButton.textContent = 'Edit Profile';

//                 // Pre-fill form with active profile data
//                 chrome.storage.sync.get('activeProfile', (activeData) => {
//                     if (activeData.activeProfile && data.profiles[activeData.activeProfile]) {
//                         const activeProfile = data.profiles[activeData.activeProfile];
//                         document.getElementById('profile-name').value = activeData.activeProfile;
//                         document.getElementById('first-name').value = activeProfile.firstName || '';
//                         document.getElementById('last-name').value = activeProfile.lastName || '';
//                         document.getElementById('email').value = activeProfile.email || '';
//                         document.getElementById('birthday').value = activeProfile.birthday || '';
//                         document.getElementById('phone').value = activeProfile.phone || '';
//                         document.getElementById('address').value = activeProfile.address || '';
//                     }
//                 });
//             }
//         });
//     }

//     /**
//      * Complete onboarding process
//      */
//     function finishOnboarding() {
//         // Mark onboarding as complete
//         chrome.storage.sync.set({ onboardingComplete: true }, () => {
//             // Check if we have at least one profile
//             chrome.storage.sync.get(['profiles', 'activeProfile'], (data) => {
//                 if (!data.profiles || Object.keys(data.profiles).length === 0) {
//                     // No profiles, show warning
//                     const createProfile = confirm('You haven\'t created a profile yet. Creating a profile will make the extension more useful. Create one now?');
//                     if (createProfile) {
//                         showStep('2');
//                         setupProfileButton.click();
//                         return;
//                     }
//                 }

//                 // Redirect to options page
//                 chrome.runtime.openOptionsPage();
//             });
//         });
//     }
// });