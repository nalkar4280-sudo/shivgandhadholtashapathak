document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase Client
    const { createClient } = supabase;
    const supabaseUrl = 'https://zztmgekdjpygnaalojrc.supabase.co';
    const supabaseKey = 'sb_publishable_okeZciLTaImpoCI3sfqdAw_fFZRIeXg';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

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
    const termsCheckbox = document.getElementById('terms');

    // Error message containers
    const nameError = document.getElementById('name-error');
    const contactError = document.getElementById('contact-error');
    const ageError = document.getElementById('age-error');
    const instrumentError = document.getElementById('instrument-error');
    const termsError = document.getElementById('terms-error');

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
            age: ageVal,
            gender: genderInput ? genderInput.value : 'Male',
            instrument: selectedInstrument ? selectedInstrument.value : '',
            termsAccepted: termsCheckbox.checked
        };

        // Disable Submit Button and show loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = `<span>Enrolling...</span><i class="fa-solid fa-spinner fa-spin"></i>`;

        try {
            const { data, error } = await supabaseClient
                .from('enrollees')
                .insert([
                    {
                        name: formData.name,
                        contact: formData.contact,
                        age: formData.age,
                        gender: formData.gender,
                        instrument: formData.instrument,
                        terms_accepted: formData.termsAccepted
                    }
                ]);

            if (error) throw error;

            // Show Success Modal
            successModal.classList.add('active');
            // Reset Form
            form.reset();
        } catch (error) {
            console.error('Submission Error:', error);
            alert('Submission failed: ' + error.message);
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
