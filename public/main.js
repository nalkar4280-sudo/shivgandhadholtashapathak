// Register Service Worker for PWA (Installable App)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered successfully!', reg.scope))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Preloader fadeout logic
    const preloader = document.getElementById('preloader');
    const hidePreloader = () => {
        setTimeout(() => {
            if (preloader) {
                preloader.classList.add('loaded');
            }
        }, 2200); // 2.2 seconds minimum display time
    };

    if (document.readyState === 'complete') {
        hidePreloader();
    } else {
        window.addEventListener('load', hidePreloader);
    }

    // Programmatic transparency for logo images (removes black background)
    const logoImages = document.querySelectorAll('.preloader-logo, .nav-logo');
    if (logoImages.length > 0) {
        const tempImg = new Image();
        tempImg.src = 'images/logo.png';
        tempImg.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = tempImg.width;
            canvas.height = tempImg.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                // Threshold to detect black background pixels and set opacity to 0
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    if (r < 30 && g < 30 && b < 30) {
                        data[i+3] = 0; // Set Alpha to transparent
                    }
                }
                ctx.putImageData(imgData, 0, 0);
                const transparentDataUrl = canvas.toDataURL();
                logoImages.forEach(img => {
                    img.src = transparentDataUrl;
                });
            } catch (err) {
                console.error("Failed to make logo transparent programmatically:", err);
            }
        };
    }

    const form = document.getElementById('enrollment-form');
    const successModal = document.getElementById('success-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const submitBtn = document.getElementById('submit-btn');

    // Form fields
    const nameInput = document.getElementById('name');
    const contactInput = document.getElementById('contact');
    const ageInput = document.getElementById('age');
    const parentContactInput = document.getElementById('parent-contact');
    const bloodGroupInput = document.getElementById('blood-group');
    const termsCheckbox = document.getElementById('terms');

    // Camera elements
    const cameraSection = document.getElementById('camera-section');
    const activateCameraBtn = document.getElementById('activate-camera-btn');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const retakePhotoBtn = document.getElementById('retake-photo-btn');
    const cameraStream = document.getElementById('camera-stream');
    const captureCanvas = document.getElementById('capture-canvas');
    const capturedPhoto = document.getElementById('captured-photo');
    const videoWrapper = document.getElementById('video-wrapper');
    const photoPreviewWrapper = document.getElementById('photo-preview-wrapper');
    const cameraPrompt = document.getElementById('camera-prompt');
    const photoDataInput = document.getElementById('photo-data');
    const photoError = document.getElementById('photo-error');

    let stream = null;

    // Error message containers
    const nameError = document.getElementById('name-error');
    const contactError = document.getElementById('contact-error');
    const ageError = document.getElementById('age-error');
    const parentContactError = document.getElementById('parent-contact-error');
    const bloodGroupError = document.getElementById('blood-group-error');
    const instrumentError = document.getElementById('instrument-error');
    const termsError = document.getElementById('terms-error');

    // Start camera stream
    const startCamera = async () => {
        try {
            photoError.style.display = 'none';
            cameraSection.classList.remove('invalid');
            
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });
            
            cameraStream.srcObject = stream;
            videoWrapper.classList.add('active');
            cameraPrompt.classList.add('hidden');
            
            capturePhotoBtn.classList.remove('hidden');
            retakePhotoBtn.classList.add('hidden');
        } catch (err) {
            console.error('Camera Access Error:', err);
            alert('Unable to access camera. Please check permissions and try again.');
        }
    };

    // Stop camera stream
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraStream.srcObject = null;
        videoWrapper.classList.remove('active');
    };

    // Capture photo from stream
    const capturePhoto = () => {
        if (!stream) return;
        
        const videoWidth = cameraStream.videoWidth || 640;
        const videoHeight = cameraStream.videoHeight || 480;
        
        captureCanvas.width = videoWidth;
        captureCanvas.height = videoHeight;
        
        const ctx = captureCanvas.getContext('2d');
        
        // Mirror the canvas draw to match mirrored video feed
        ctx.translate(videoWidth, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(cameraStream, 0, 0, videoWidth, videoHeight);
        
        // Convert to base64 jpeg
        const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.85);
        photoDataInput.value = dataUrl;
        
        // Update previews
        capturedPhoto.src = dataUrl;
        photoPreviewWrapper.classList.remove('hidden');
        videoWrapper.classList.add('hidden');
        
        capturePhotoBtn.classList.add('hidden');
        retakePhotoBtn.classList.remove('hidden');
        
        stopCamera();
        
        // Remove validation error if present
        cameraSection.classList.remove('invalid');
    };

    // Retake photo
    const retakePhoto = () => {
        photoDataInput.value = '';
        capturedPhoto.src = '';
        photoPreviewWrapper.classList.add('hidden');
        videoWrapper.classList.remove('hidden');
        cameraPrompt.classList.remove('hidden');
        
        capturePhotoBtn.classList.add('hidden');
        retakePhotoBtn.classList.add('hidden');
        
        startCamera();
    };

    // Bind camera click listeners
    activateCameraBtn.addEventListener('click', startCamera);
    capturePhotoBtn.addEventListener('click', capturePhoto);
    retakePhotoBtn.addEventListener('click', retakePhoto);

    // Real-time input validation removers
    nameInput.addEventListener('input', () => {
        if (nameInput.value.trim().length > 0) {
            nameInput.closest('.input-group').classList.remove('invalid');
        }
    });

    contactInput.addEventListener('input', () => {
        const contactVal = contactInput.value.trim();
        const contactPattern = /^[0-9]{10}$/;
        if (contactPattern.test(contactVal)) {
            contactInput.closest('.input-group').classList.remove('invalid');
        }
    });

    ageInput.addEventListener('input', () => {
        const ageVal = parseInt(ageInput.value);
        if (!isNaN(ageVal) && ageVal >= 10 && ageVal <= 80) {
            ageInput.closest('.input-group').classList.remove('invalid');
        }
    });

    parentContactInput.addEventListener('input', () => {
        const parentVal = parentContactInput.value.trim();
        const contactPattern = /^[0-9]{10}$/;
        if (contactPattern.test(parentVal)) {
            parentContactInput.closest('.input-group').classList.remove('invalid');
        }
    });

    bloodGroupInput.addEventListener('change', () => {
        if (bloodGroupInput.value !== '') {
            bloodGroupInput.closest('.input-group').classList.remove('invalid');
        }
    });

    // Real-time input validation removers for instrument radios
    const getSelectedInstrument = () => document.querySelector('input[name="instrument"]:checked');
    
    document.querySelectorAll('input[name="instrument"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (getSelectedInstrument()) {
                radio.closest('.input-group').classList.remove('invalid');
            }
        });
    });

    termsCheckbox.addEventListener('change', () => {
        if (termsCheckbox.checked) {
            termsCheckbox.closest('.input-group').classList.remove('invalid');
        }
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate all fields
        let isValid = true;

        // Name Validation
        if (nameInput.value.trim() === '') {
            nameInput.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            nameInput.closest('.input-group').classList.remove('invalid');
        }

        // WhatsApp Validation (10 digits)
        const contactVal = contactInput.value.trim();
        const contactPattern = /^[0-9]{10}$/;
        if (contactVal === '' || !contactPattern.test(contactVal)) {
            contactInput.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            contactInput.closest('.input-group').classList.remove('invalid');
        }

        // Parent Contact Validation (10 digits)
        const parentContactVal = parentContactInput.value.trim();
        if (parentContactVal === '' || !contactPattern.test(parentContactVal)) {
            parentContactInput.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            parentContactInput.closest('.input-group').classList.remove('invalid');
        }

        // Blood Group Validation
        if (bloodGroupInput.value === '') {
            bloodGroupInput.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            bloodGroupInput.closest('.input-group').classList.remove('invalid');
        }

        // Age Validation
        const ageVal = parseInt(ageInput.value);
        if (ageInput.value === '' || isNaN(ageVal) || ageVal < 10 || ageVal > 80) {
            ageInput.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            ageInput.closest('.input-group').classList.remove('invalid');
        }

        // Instrument Validation
        const selectedInstrument = getSelectedInstrument();
        if (!selectedInstrument) {
            document.querySelector('input[name="instrument"]').closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            document.querySelector('input[name="instrument"]').closest('.input-group').classList.remove('invalid');
        }

        // Photo Validation
        if (photoDataInput.value === '') {
            cameraSection.classList.add('invalid');
            isValid = false;
        } else {
            cameraSection.classList.remove('invalid');
        }

        // Terms Checkbox Validation
        if (!termsCheckbox.checked) {
            termsCheckbox.closest('.input-group').classList.add('invalid');
            isValid = false;
        } else {
            termsCheckbox.closest('.input-group').classList.remove('invalid');
        }

        if (!isValid) {
            return;
        }

        // Gather Form Data
        const genderInput = document.querySelector('input[name="gender"]:checked');
        const formData = {
            name: nameInput.value.trim(),
            contact: contactInput.value.trim(),
            parentContact: parentContactVal,
            bloodGroup: bloodGroupInput.value,
            age: ageVal,
            gender: genderInput ? genderInput.value : 'Male',
            instrument: selectedInstrument ? selectedInstrument.value : '',
            termsAccepted: termsCheckbox.checked,
            photo: photoDataInput.value
        };

        // Disable Submit Button and show loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span>Enrolling...</span><i class="fa-solid fa-spinner fa-spin"></i>`;

        try {
            const response = await fetch('/api/enroll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show Success Modal
                successModal.classList.add('active');
                // Reset Form
                form.reset();
                // Reset camera UI
                photoDataInput.value = '';
                capturedPhoto.src = '';
                photoPreviewWrapper.classList.add('hidden');
                videoWrapper.classList.remove('hidden');
                cameraPrompt.classList.remove('hidden');
                capturePhotoBtn.classList.add('hidden');
                retakePhotoBtn.classList.add('hidden');
                stopCamera();
            } else {
                alert(result.message || 'Something went wrong. Please try again.');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            alert('Failed to connect to the server. Please ensure the server is running.');
        } finally {
            // Re-enable Submit Button
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    });

    // Close Modal Button Event
    closeModalBtn.addEventListener('click', () => {
        successModal.classList.remove('active');
    });

    // Close Modal when clicking outside the success card
    successModal.addEventListener('click', (e) => {
        if (e.target === successModal) {
            successModal.classList.remove('active');
        }
    });
});
