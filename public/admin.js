// Register Service Worker for PWA (Installable App)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered successfully!', reg.scope))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // In-memory admin authentication token (automatically wiped on page refresh)
    let adminToken = null;

    // Programmatic transparency for nav logo (removes black background)
    const navLogo = document.querySelector('.nav-logo');
    if (navLogo) {
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
                navLogo.src = canvas.toDataURL();
            } catch (err) {
                console.error("Failed to make nav logo transparent programmatically:", err);
            }
        };
    }

    // Memory state
    let enrollees = [];
    let deleteTargetId = null;

    // DOM Elements
    const tableBody = document.getElementById('table-body');
    const filteredCountBadge = document.getElementById('filtered-count');
    const refreshBtn = document.getElementById('refresh-btn');
    
    // Stats elements
    const statTotal = document.getElementById('stat-total');
    const statDhol = document.getElementById('stat-dhol');
    const statTasha = document.getElementById('stat-tasha');
    const statDhwajdhari = document.getElementById('stat-dhwajdhari');
    const statFemale = document.getElementById('stat-female');

    // Filter elements
    const searchInput = document.getElementById('search-input');
    const filterInstrument = document.getElementById('filter-instrument');
    const filterGender = document.getElementById('filter-gender');

    // Delete Modal elements
    const deleteModal = document.getElementById('delete-modal');
    const deleteTargetNameSpan = document.getElementById('delete-target-name');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // ID Card View Modal Elements
    const idCardModal = document.getElementById('id-card-modal');
    const closeCardBtn = document.getElementById('close-card-btn');
    const printCardBtn = document.getElementById('print-card-btn');
    const downloadPhotoBtn = document.getElementById('download-photo-btn');
    
    // ID Card content elements
    const idCardPhoto = document.getElementById('id-card-photo');
    const idCardName = document.getElementById('id-card-name');
    const idCardInstrument = document.getElementById('id-card-instrument');
    const idCardBlood = document.getElementById('id-card-blood');
    const idCardAgeGender = document.getElementById('id-card-age-gender');
    const idCardId = document.getElementById('id-card-id');
    const idCardContact = document.getElementById('id-card-contact');
    const idCardParent = document.getElementById('id-card-parent');
    const idCardBarcodeVal = document.getElementById('id-card-barcode-val');

    // Auth Screen elements
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const adminPasswordInput = document.getElementById('admin-password');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const loginErrorMsg = document.getElementById('login-error-msg');
    const adminContents = document.querySelectorAll('.admin-content');

    function showLogin() {
        loginOverlay.classList.add('active');
        adminContents.forEach(el => el.classList.add('hidden'));
        adminPasswordInput.value = '';
    }

    function hideLogin() {
        loginOverlay.classList.remove('active');
        adminContents.forEach(el => el.classList.remove('hidden'));
    }

    function getAuthToken() {
        return adminToken;
    }

    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
        };
    }

    // Fetch enrollees from API
    async function fetchEnrollees() {
        const token = getAuthToken();
        if (!token) {
            showLogin();
            return;
        }
        showLoadingState();
        try {
            const response = await fetch('/api/enrollees', {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                adminToken = null;
                showLogin();
                return;
            }

            const result = await response.json();
            
            if (response.ok && result.success) {
                enrollees = result.data || [];
                updateDashboard();
            } else {
                showErrorState(result.message || 'Failed to fetch enrollees.');
            }
        } catch (error) {
            console.error('Error fetching enrollees:', error);
            showErrorState('Failed to connect to the backend server.');
        }
    }

    // Show table loading animation
    function showLoadingState() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="table-empty">
                    <i class="fa-solid fa-spinner fa-spin empty-icon"></i>
                    <p>Loading enrollees list...</p>
                </td>
            </tr>
        `;
    }

    // Show table error message
    function showErrorState(message) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="table-empty">
                    <i class="fa-solid fa-circle-exclamation empty-icon" style="color: var(--error-red)"></i>
                    <p>${message}</p>
                </td>
            </tr>
        `;
    }

    // Update both stats and table
    function updateDashboard() {
        updateStats();
        renderTable();
    }

    // Compute and display stats counters
    function updateStats() {
        const total = enrollees.length;
        const dhols = enrollees.filter(e => e.instrument === 'Dhol').length;
        const tashas = enrollees.filter(e => e.instrument === 'Tasha').length;
        const dhwajdharis = enrollees.filter(e => e.instrument === 'Dhwajdhari').length;
        const females = enrollees.filter(e => e.gender === 'Female').length;

        // Animate counter values
        animateCounter(statTotal, total);
        animateCounter(statDhol, dhols);
        animateCounter(statTasha, tashas);
        animateCounter(statDhwajdhari, dhwajdharis);
        animateCounter(statFemale, females);
    }

    // Simple counter animation helper
    function animateCounter(element, targetValue) {
        let currentValue = parseInt(element.textContent) || 0;
        if (currentValue === targetValue) {
            element.textContent = targetValue;
            return;
        }

        const duration = 400; // ms
        const steps = 20;
        const stepTime = duration / steps;
        const increment = (targetValue - currentValue) / steps;
        let count = 0;

        const timer = setInterval(() => {
            currentValue += increment;
            count++;
            
            if (count >= steps) {
                clearInterval(timer);
                element.textContent = targetValue;
            } else {
                element.textContent = Math.round(currentValue);
            }
        }, stepTime);
    }

    // Filter and Render table data
    function renderTable() {
        const searchQuery = searchInput.value.toLowerCase().trim();
        const selectedInstrument = filterInstrument.value;
        const selectedGender = filterGender.value;

        // Apply filters
        const filteredData = enrollees.filter(e => {
            const matchesSearch = e.name.toLowerCase().includes(searchQuery);
            const matchesInstrument = selectedInstrument === 'All' || e.instrument === selectedInstrument;
            const matchesGender = selectedGender === 'All' || e.gender === selectedGender;
            return matchesSearch && matchesInstrument && matchesGender;
        });

        // Update badge counter
        filteredCountBadge.textContent = `${filteredData.length} ${filteredData.length === 1 ? 'entry' : 'entries'}`;

        if (filteredData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="table-empty">
                        <i class="fa-solid fa-folder-open empty-icon"></i>
                        <p>No matching enrollees found.</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Render rows
        tableBody.innerHTML = filteredData.map(e => {
            const dateStr = formatDate(e.enrolledAt);
            const instClass = `inst-${e.instrument.toLowerCase()}`;
            const whatsappLink = e.contact ? `<a href="https://wa.me/91${e.contact}" target="_blank" class="whatsapp-link" title="Message on WhatsApp"><i class="fa-brands fa-whatsapp"></i> ${escapeHTML(e.contact)}</a>` : 'N/A';
            const parentContactLink = e.parentContact ? `<a href="tel:+91${e.parentContact}" class="phone-link" title="Call Parent"><i class="fa-solid fa-phone"></i> ${escapeHTML(e.parentContact)}</a>` : 'N/A';
            const bloodGroupTag = e.bloodGroup ? `<span class="blood-group-tag"><i class="fa-solid fa-droplet"></i> ${escapeHTML(e.bloodGroup)}</span>` : 'N/A';
            
            // Avatar Column Setup
            let avatarHTML = '';
            if (e.photoUrl) {
                const initials = getInitials(e.name);
                const fallbackClass = `avatar-${e.instrument ? e.instrument.toLowerCase() : 'fallback'}`;
                avatarHTML = `<img class="member-avatar" src="${e.photoUrl}" alt="${escapeHTML(e.name)}" data-id="${e.id}" title="Click to view Identity Card" onerror="this.outerHTML='<span class=\\'member-initials-avatar ${fallbackClass}\\' data-id=\\'${e.id}\\' title=\\'Click to view Identity Card\\'>${initials}</span>'">`;
            } else {
                avatarHTML = `<span class="member-initials-avatar avatar-${e.instrument ? e.instrument.toLowerCase() : 'fallback'}" data-id="${e.id}" title="Click to view Identity Card">${getInitials(e.name)}</span>`;
            }

            return `
                <tr>
                    <td>
                        <div class="member-profile-cell">
                            ${avatarHTML}
                            <span class="clickable-name member-name" data-id="${e.id}" title="Click to view Identity Card">${escapeHTML(e.name)}</span>
                        </div>
                    </td>
                    <td>${whatsappLink}</td>
                    <td>${parentContactLink}</td>
                    <td>${e.age} yrs</td>
                    <td><span class="gender-tag">${e.gender}</span></td>
                    <td>${bloodGroupTag}</td>
                    <td><span class="badge-instrument ${instClass}">${e.instrument}</span></td>
                    <td><span class="date-text">${dateStr}</span></td>
                    <td class="text-right">
                        <button class="delete-action-btn" data-id="${e.id}" data-name="${escapeHTML(e.name)}" title="Remove applicant">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners to newly created delete buttons
        document.querySelectorAll('.delete-action-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const button = event.currentTarget;
                deleteTargetId = button.getAttribute('data-id');
                deleteTargetNameSpan.textContent = button.getAttribute('data-name');
                deleteModal.classList.add('active');
            });
        });

        // Attach event listeners to avatars & names to open ID Card Modal
        document.querySelectorAll('.member-avatar, .member-initials-avatar, .clickable-name').forEach(el => {
            el.addEventListener('click', (event) => {
                const id = event.currentTarget.getAttribute('data-id');
                openIdCard(id);
            });
        });
    }

    // Helper to format ISO dates to user friendly string
    function formatDate(isoString) {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Helper to escape HTML characters
    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Delete Operations
    async function deleteEnrollee() {
        if (!deleteTargetId) return;

        const token = getAuthToken();
        if (!token) {
            showLogin();
            return;
        }

        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'Removing...';

        try {
            const response = await fetch(`/api/enrollees/${deleteTargetId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                adminToken = null;
                closeDeleteModal();
                showLogin();
                return;
            }

            const result = await response.json();

            if (response.ok && result.success) {
                // Update local memory & re-render
                enrollees = enrollees.filter(e => e.id !== deleteTargetId);
                updateDashboard();
                closeDeleteModal();
            } else {
                alert(result.message || 'Failed to remove enrollee.');
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to connect to backend server for deletion.');
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'Remove';
        }
    }

    function closeDeleteModal() {
        deleteModal.classList.remove('active');
        deleteTargetId = null;
    }

    // Bind Event Listeners for Filters
    searchInput.addEventListener('input', renderTable);
    filterInstrument.addEventListener('change', renderTable);
    filterGender.addEventListener('change', renderTable);

    // Refresh button click
    refreshBtn.addEventListener('click', fetchEnrollees);

    // Delete Modal controls
    confirmDeleteBtn.addEventListener('click', deleteEnrollee);
    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    // Modal background click
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) {
            closeDeleteModal();
        }
    });

    // Login Submit Form Event
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = adminPasswordInput.value;
        
        loginErrorMsg.style.display = 'none';
        loginForm.querySelector('.input-group').classList.remove('invalid');
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const result = await response.json();
            if (response.ok && result.success) {
                adminToken = result.token;
                hideLogin();
                fetchEnrollees();
            } else {
                loginForm.querySelector('.input-group').classList.add('invalid');
                loginErrorMsg.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Connection to server failed.');
        }
    });

    // Password Visibility Toggle
    togglePasswordBtn.addEventListener('click', () => {
        const type = adminPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        adminPasswordInput.setAttribute('type', type);
        const icon = togglePasswordBtn.querySelector('i');
        if (type === 'password') {
            icon.className = 'fa-solid fa-eye';
        } else {
            icon.className = 'fa-solid fa-eye-slash';
        }
    });

    // Password input event to clear validation error
    adminPasswordInput.addEventListener('input', () => {
        loginForm.querySelector('.input-group').classList.remove('invalid');
        loginErrorMsg.style.display = 'none';
    });

    // Helper to calculate initials
    function getInitials(name) {
        if (!name) return 'SG';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    }

    // Open Glassmorphic Identity Card Modal
    function openIdCard(id) {
        const e = enrollees.find(x => x.id === id);
        if (!e) return;
        
        // Fill card values
        idCardName.textContent = e.name;
        idCardInstrument.textContent = e.instrument;
        
        // Set instrument badge class
        idCardInstrument.className = `value badge-instrument inst-${e.instrument.toLowerCase()}`;
        
        idCardBlood.textContent = e.bloodGroup || 'N/A';
        idCardAgeGender.textContent = `${e.age} yrs / ${e.gender}`;
        
        // Format display ID
        const displayIdStr = String(e.id).substring(Math.max(0, String(e.id).length - 4));
        idCardId.textContent = `SG-2026-${displayIdStr}`;
        
        idCardContact.textContent = e.contact ? `+91 ${e.contact}` : 'N/A';
        idCardParent.textContent = e.parentContact ? `+91 ${e.parentContact}` : 'N/A';
        
        // Set photo or fallback
        if (e.photoUrl) {
            idCardPhoto.src = e.photoUrl;
            
            // Handle loading error to display SVG fallback on ID card
            idCardPhoto.onerror = () => {
                const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="110" height="135" viewBox="0 0 110 135"><rect width="100%" height="100%" fill="%23222"/><text x="50%" y="50%" font-size="24" fill="%23777" font-family="Outfit, sans-serif" font-weight="bold" dominant-baseline="middle" text-anchor="middle">${getInitials(e.name)}</text></svg>`;
                idCardPhoto.src = fallbackSvg;
                downloadPhotoBtn.href = fallbackSvg;
                downloadPhotoBtn.download = `${e.name.toLowerCase().replace(/\s+/g, '_')}_avatar.svg`;
                idCardPhoto.onerror = null; // Prevent loop
            };
            
            // Set download button properties
            downloadPhotoBtn.href = e.photoUrl;
            downloadPhotoBtn.download = `${e.name.toLowerCase().replace(/\s+/g, '_')}_photo.jpg`;
            downloadPhotoBtn.style.display = 'inline-flex';
        } else {
            idCardPhoto.onerror = null;
            const fallbackSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="110" height="135" viewBox="0 0 110 135"><rect width="100%" height="100%" fill="%23222"/><text x="50%" y="50%" font-size="24" fill="%23777" font-family="Outfit, sans-serif" font-weight="bold" dominant-baseline="middle" text-anchor="middle">${getInitials(e.name)}</text></svg>`;
            idCardPhoto.src = fallbackSvg;
            
            // Allow download of initials SVG card photo
            downloadPhotoBtn.href = fallbackSvg;
            downloadPhotoBtn.download = `${e.name.toLowerCase().replace(/\s+/g, '_')}_avatar.svg`;
            downloadPhotoBtn.style.display = 'inline-flex';
        }
        
        idCardBarcodeVal.textContent = `SG2026${e.id}`;
        idCardModal.classList.add('active');
    }
 
    function closeIdCard() {
        idCardModal.classList.remove('active');
        idCardPhoto.src = '';
        idCardPhoto.onerror = null;
        downloadPhotoBtn.href = '#';
    }

    // Bind ID Card Close / Print triggers
    closeCardBtn.addEventListener('click', closeIdCard);
    
    idCardModal.addEventListener('click', (e) => {
        if (e.target === idCardModal) {
            closeIdCard();
        }
    });

    printCardBtn.addEventListener('click', () => {
        window.print();
    });

    // Initial load check
    const token = getAuthToken();
    if (token) {
        hideLogin();
        fetchEnrollees();
    } else {
        showLogin();
    }
});
