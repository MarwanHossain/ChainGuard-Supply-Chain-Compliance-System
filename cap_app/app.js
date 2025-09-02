// --- State & Initialization ---
let currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
let complianceChartInstance = null;

function initializeData() {
    if (!localStorage.getItem('users')) {
        localStorage.setItem('users', JSON.stringify([
            { id: 'manager-1', name: 'Logistic Manager', email: 'manager@log.com', role: 'manager' },
            { id: 'vendor-a', name: 'Vendor A', email: 'vendora@log.com', role: 'vendor' },
            { id: 'vendor-b', name: 'Vendor B', email: 'vendorb@log.com', role: 'vendor' },
            { id: 'admin-1', name: 'System Admin', email: 'admin@log.com', role: 'admin' },
        ]));
    }
    if (!localStorage.getItem('shipments')) {
        localStorage.setItem('shipments', JSON.stringify([
            { id: 'SH-123', vendorId: 'vendor-a', date: '2025-08-10', details: 'Vaccine Consignment', status: 'In Transit' },
            { id: 'SH-125', vendorId: 'vendor-b', date: '2025-08-05', details: 'Medical Supplies', status: 'Scheduled' },
        ]));
    }
    if (!localStorage.getItem('documents')) localStorage.setItem('documents', JSON.stringify([]));
    if (!localStorage.getItem('notifications')) localStorage.setItem('notifications', JSON.stringify([]));
    if (!localStorage.getItem('complianceRules')) {
        localStorage.setItem('complianceRules', '1. All temperature-sensitive shipments must maintain a range of 2-8°C.\n2. All drivers must have a valid commercial driver\'s license.\n3. Proof of delivery (POD) with OTP confirmation is mandatory for all shipments.');
    }
}

// --- Data Accessors ---
const getUsers = () => JSON.parse(localStorage.getItem('users'));
const saveUsers = (users) => localStorage.setItem('users', JSON.stringify(users));
const getShipments = () => JSON.parse(localStorage.getItem('shipments'));
const saveShipments = (shipments) => localStorage.setItem('shipments', JSON.stringify(shipments));
const getDocuments = () => JSON.parse(localStorage.getItem('documents'));
const saveDocuments = (documents) => localStorage.setItem('documents', JSON.stringify(documents));
const getNotifications = () => JSON.parse(localStorage.getItem('notifications'));
const saveNotifications = (notifications) => localStorage.setItem('notifications', JSON.stringify(notifications));
const getComplianceRules = () => localStorage.getItem('complianceRules');
const saveComplianceRules = (rules) => localStorage.setItem('complianceRules', rules);

// --- Navigation & Auth ---
function navigateTo(page) {
    window.location.href = page;
}

function protectPage(allowedRoles) {
    if (!currentUser || !allowedRoles.includes(currentUser.role)) {
        navigateTo('login.html');
        return null;
    }
    return currentUser;
}

function logout() {
    sessionStorage.removeItem('currentUser');
    currentUser = null; 
    navigateTo('login.html');
}

// --- UI Rendering ---
function renderManagerDashboard() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    mainContent.innerHTML = `
        <h1 class="text-3xl font-bold text-slate-800 mb-6">Manager Dashboard</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Active Shipments</h2><div id="shipmentList" class="space-y-3"></div></div>
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Notifications</h2><div id="managerNotifications" class="space-y-3"></div></div>
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Actions</h2><div class="space-y-3"><button onclick="toggleModal('shipmentModal', true)" class="w-full btn-primary bg-green-600 hover:bg-green-700">Create New Shipment</button><button onclick="generateReport()" class="w-full btn-secondary">Download Reports</button></div></div>
        </div>
        <div class="card">
            <h2 class="font-bold text-lg mb-4 text-slate-800">Cold Chain Compliance: Live Temperature (Shipment SH-123)</h2>
            <div class="h-80 relative"><canvas id="complianceChart"></canvas></div>
        </div>
    `;
    
    const shipments = getShipments();
    const shipmentList = document.getElementById('shipmentList');
    const statusColors = { 'Scheduled': 'bg-yellow-100 text-yellow-800', 'In Transit': 'bg-blue-100 text-blue-800', 'Delivered': 'bg-green-100 text-green-800' };
    if (shipments.length === 0) {
        shipmentList.innerHTML = '<p class="text-slate-500">No active shipments.</p>';
    } else {
        shipmentList.innerHTML = shipments.map(shipment => {
            const vendorName = getUsers().find(u => u.id === shipment.vendorId)?.name || 'Unknown';
            return `<div class="flex justify-between items-center text-sm"><p class="text-slate-700">${shipment.id} <span class="text-slate-500">(${vendorName})</span></p><span class="${statusColors[shipment.status] || 'bg-slate-100 text-slate-800'} text-xs font-medium px-2.5 py-0.5 rounded-full">${shipment.status}</span></div>`;
        }).join('');
    }

    const managerNotifications = document.getElementById('managerNotifications');
    const notifications = getNotifications().filter(n => n.recipientRole === 'manager' && !n.read);
    managerNotifications.innerHTML = notifications.length > 0 ? notifications.map(n => `<p class="text-sm text-teal-700">${n.message}</p>`).join('') : '<p class="text-slate-500 text-sm">No new notifications.</p>';
    
    renderComplianceChart();

    const vendorSelect = document.getElementById('vendorSelect');
    if (vendorSelect) {
        const vendors = getUsers().filter(u => u.role === 'vendor');
        vendorSelect.innerHTML = vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    }
}

function renderComplianceChart() {
    if (complianceChartInstance) complianceChartInstance.destroy();
    const ctx = document.getElementById('complianceChart')?.getContext('2d');
    if (!ctx) return;
    const complianceData = {
        labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
        temperatures: [4.5, 4.8, 5.1, 8.2, 5.5, 5.2, 4.9, 4.6] 
    };
    const safeMin = 2, safeMax = 8;

    complianceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: complianceData.labels,
            datasets: [{
                label: 'Temperature (°C)',
                data: complianceData.temperatures,
                borderColor: '#0d9488',
                tension: 0.2,
                pointBackgroundColor: complianceData.temperatures.map(t => t > safeMax || t < safeMin ? '#ef4444' : '#0d9488'),
                pointRadius: 5, pointHoverRadius: 7,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: false, title: { display: true, text: 'Temperature (°C)' } }, x: { title: { display: true, text: 'Time' } } },
            plugins: { legend: { display: false },
                annotation: { annotations: { box1: { type: 'box', yMin: safeMin, yMax: safeMax, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1 } } }
            }
        }
    });
}

function renderVendorDashboard() {
    if (!currentUser) return;
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    mainContent.innerHTML = `
        <h1 class="text-3xl font-bold text-slate-800 mb-6">Vendor Dashboard</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Complete a Shipment</h2><div id="vendorShipmentList" class="space-y-3"></div></div>
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Document Status</h2><div id="vendorDocStatus" class="space-y-3"></div><button onclick="toggleModal('documentModal', true)" class="mt-4 w-full btn-primary">Upload/Renew Documents</button></div>
            <div class="card"><h2 class="font-bold text-lg mb-4 text-slate-800">Notifications</h2><div id="vendorNotifications" class="space-y-3"></div></div>
            <div class="card md:col-span-2 lg:col-span-3"><h2 class="font-bold text-lg mb-4 text-slate-800">Compliance Rules</h2><div id="complianceRulesDisplay" class="text-sm text-slate-600 space-y-2"></div></div>
        </div>
    `;

    const shipments = getShipments().filter(s => s.vendorId === currentUser.id);
    const documents = getDocuments().filter(d => d.vendorId === currentUser.id);
    const notifications = getNotifications().filter(n => n.recipientId === currentUser.id && !n.read);
    
    const vendorShipmentList = document.getElementById('vendorShipmentList');
    const activeShipments = shipments.filter(s => s.status === 'Scheduled' || s.status === 'In Transit');
    vendorShipmentList.innerHTML = activeShipments.length > 0 ? activeShipments.map(shipment => `<div class="flex justify-between items-center text-sm"><div><p class="text-slate-700 font-semibold">${shipment.id}</p><p class="text-slate-500 text-xs">${shipment.details}</p></div><button onclick="openCompletionModal('${shipment.id}')" class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-xs">Complete</button></div>`).join('') : '<p class="text-slate-500 text-sm">No active shipments.</p>';

    const vendorDocStatus = document.getElementById('vendorDocStatus');
    const docStatusColors = { 'Pending': 'text-yellow-600', 'Approved': 'text-green-600', 'Rejected': 'text-red-600' };
    vendorDocStatus.innerHTML = documents.length > 0 ? documents.map(d => `<div class="text-sm"><p class="font-semibold text-slate-700">${d.type}</p><p class="${docStatusColors[d.status]}">${d.status}${d.status === 'Rejected' ? ` <span class="text-slate-500">- ${d.rejectionReason}</span>` : ''}</p></div>`).join('') : '<p class="text-slate-500 text-sm">No documents uploaded.</p>';

    const vendorNotifications = document.getElementById('vendorNotifications');
    vendorNotifications.innerHTML = notifications.length > 0 ? notifications.map(n => `<p class="text-sm text-red-600">${n.message}</p>`).join('') : '<p class="text-slate-500 text-sm">No new notifications.</p>';

    const rulesText = getComplianceRules();
    document.getElementById('complianceRulesDisplay').innerHTML = rulesText.split('\n').map(line => `<p>${line}</p>`).join('');
}

function renderAdminDashboard() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;
    mainContent.innerHTML = `
        <h1 class="text-3xl font-bold text-slate-800 mb-6">Admin Dashboard</h1>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="card">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-bold text-lg text-slate-800">User Management</h2>
                    <button onclick="toggleModal('addUserModal', true)" class="btn-primary text-sm">Add User</button>
                </div>
                <div id="userList" class="space-y-3"></div>
            </div>
            <div class="card">
                <h2 class="font-bold text-lg mb-4 text-slate-800">Compliance Dashboard</h2>
                <textarea id="complianceRulesEditor" rows="5" class="input-field w-full mb-4"></textarea>
                <button id="saveRulesBtn" class="btn-primary w-full">Save Rules</button>
            </div>
            <div class="card lg:col-span-2">
                <h2 class="font-bold text-lg mb-4 text-slate-800">Pending Document Approvals</h2>
                <div id="pendingApprovalsList" class="space-y-4"></div>
            </div>
        </div>
    `;
    
    renderUserList();

    const rulesEditor = document.getElementById('complianceRulesEditor');
    rulesEditor.value = getComplianceRules();
    document.getElementById('saveRulesBtn').addEventListener('click', () => {
        saveComplianceRules(rulesEditor.value);
        showAlert('Compliance rules have been updated.');
    });

    const approvalList = document.getElementById('pendingApprovalsList');
    const pendingDocs = getDocuments().filter(d => d.status === 'Pending');
    if (pendingDocs.length > 0) {
        approvalList.innerHTML = pendingDocs.map(doc => {
            const vendor = getUsers().find(u => u.id === doc.vendorId);
            return `<div class="p-4 border border-slate-200 rounded-lg flex justify-between items-center"><div class="text-sm"><p class="font-bold text-slate-800">${doc.type} - <span class="font-normal text-slate-600">${vendor ? vendor.name : 'Unknown'}</span></p><p class="text-slate-500">Expires: ${doc.expiry}</p></div><div class="space-x-2"><button onclick="approveDocument('${doc.id}')" class="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-xs">Approve</button><button onclick="rejectDocument('${doc.id}')" class="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-xs">Reject</button></div></div>`;
        }).join('');
    } else {
        approvalList.innerHTML = '<p class="text-slate-500 text-sm">No documents are pending approval.</p>';
    }
}

function renderUserList() {
    const userList = document.getElementById('userList');
    if (!userList) return;
    userList.innerHTML = getUsers().map(user => `
        <div id="user-${user.id}" class="flex justify-between items-center text-sm p-2 rounded-md hover:bg-slate-50">
            <p class="text-slate-700">${user.name} <span class="text-slate-500">(${user.role})</span></p>
            <button onclick="removeUser('${user.id}')" class="btn-danger">Remove</button>
        </div>
    `).join('');
}

// --- Modals & Alerts ---
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
}

function showAlert(message) {
    const alertMessage = document.getElementById('alertMessage');
    if (alertMessage) {
        alertMessage.textContent = message;
        toggleModal('alertModal', true);
    }
}

function openCompletionModal(shipmentId) {
    const shipment = getShipments().find(s => s.id === shipmentId);
    if (shipment) {
        document.getElementById('completionShipmentId').value = shipment.id;
        document.getElementById('modalShipmentId').textContent = shipment.id;
        document.getElementById('modalShipmentDetails').textContent = shipment.details;
        toggleModal('completionModal', true);
    }
}

// --- Core Logic ---
function removeUser(userId) {
    let users = getUsers();
    const updatedUsers = users.filter(user => user.id !== userId);
    if (updatedUsers.length < users.length) {
        saveUsers(updatedUsers);
        renderUserList();
    }
}

function approveDocument(docId) {
    let documents = getDocuments();
    const docIndex = documents.findIndex(d => d.id === docId);
    if (docIndex > -1) {
        documents[docIndex].status = 'Approved';
        saveDocuments(documents);
        renderAdminDashboard(); 
    }
}

function rejectDocument(docId) {
    document.getElementById('rejectionDocId').value = docId;
    toggleModal('rejectionModal', true);
}

function generateReport() {
    const shipments = getShipments();
    const users = getUsers();
    const documents = getDocuments();
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;

    let reportHTML = '<div class="space-y-6">';

    shipments.forEach(shipment => {
        const vendor = users.find(u => u.id === shipment.vendorId);
        if (!vendor) return;

        let deliveryStatus = '<span class="text-slate-500">Pending</span>';
        if (shipment.status === 'Delivered') {
            const scheduledDate = new Date(shipment.date);
            const completionDate = new Date(shipment.completionDate);
            deliveryStatus = completionDate <= scheduledDate 
                ? '<span class="font-semibold text-green-600">On Time</span>' 
                : '<span class="font-semibold text-red-600">Late</span>';
        }

        let coldChainStatus;
        const lastDigit = parseInt(shipment.id.slice(-1));
        if (isNaN(lastDigit) || lastDigit % 2 === 0) {
            coldChainStatus = '<span class="font-semibold text-green-600">Compliant</span>';
        } else {
            coldChainStatus = '<span class="font-semibold text-red-600">Breach Detected</span>';
        }

        const vendorDocs = documents.filter(d => d.vendorId === vendor.id);
        const expiredDocs = vendorDocs.filter(d => new Date(d.expiry) < new Date());
        let docStatus = '<span class="font-semibold text-green-600">All Valid</span>';
        if (expiredDocs.length > 0) {
            docStatus = `<span class="font-semibold text-red-600">${expiredDocs.length} Expired</span>`;
        } else if (vendorDocs.length === 0) {
            docStatus = '<span class="font-semibold text-yellow-600">No Documents</span>';
        }
        
        reportHTML += `
            <div class="p-4 border border-slate-200 rounded-lg">
                <h3 class="font-bold text-lg text-slate-800">${shipment.id} - ${vendor.name}</h3>
                <div class="grid grid-cols-3 gap-4 mt-2 text-sm">
                    <div><p class="text-slate-500">Delivery:</p> ${deliveryStatus}</div>
                    <div><p class="text-slate-500">Cold Chain:</p> ${coldChainStatus}</div>
                    <div><p class="text-slate-500">Documents:</p> ${docStatus}</div>
                </div>
            </div>
        `;
    });

    reportHTML += '</div>';
    reportContent.innerHTML = reportHTML;
    toggleModal('reportModal', true);
}

function toggleMenu(menuId, event) {
    event.stopPropagation();
    const targetMenu = document.getElementById(menuId);
    const isAlreadyOpen = targetMenu.classList.contains('locked-open');

    document.querySelectorAll('.menu-dropdown').forEach(menu => {
        menu.classList.remove('locked-open');
    });

    if (!isAlreadyOpen) {
        targetMenu.classList.add('locked-open');
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.menu-dropdown').forEach(menu => {
            menu.classList.remove('locked-open');
        });
    });

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const role = document.getElementById('role').value;
            const user = getUsers().find(u => u.role === role);
            if (user) {
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                navigateTo(`${user.role}.html`);
            } else {
                showAlert('Could not find a user for the selected role.');
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(event) {
            event.preventDefault();
            let users = getUsers();
            const newUser = { id: document.getElementById('role-register').value + '-' + Date.now(), name: document.getElementById('name-register').value, email: document.getElementById('email-register').value, role: document.getElementById('role-register').value };
            users.push(newUser);
            saveUsers(users);
            showAlert('Registration successful! Please login.');
            this.reset();
            navigateTo('login.html');
        });
    }
    
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', function(event) {
            event.preventDefault();
            showAlert('If an account exists for this email, a reset link has been sent.');
            this.reset();
            navigateTo('login.html');
        });
    }

    const newShipmentForm = document.getElementById('newShipmentForm');
    if (newShipmentForm) {
        newShipmentForm.addEventListener('submit', function(event) {
            event.preventDefault();
            let shipments = getShipments();
            const newShipment = { id: document.getElementById('shipmentId').value || 'SH-' + Date.now(), vendorId: document.getElementById('vendorSelect').value, date: document.getElementById('deliveryDate').value, details: document.getElementById('shipmentDetails').value, status: 'Scheduled' };
            shipments.unshift(newShipment);
            saveShipments(shipments);
            renderManagerDashboard();
            this.reset();
            toggleModal('shipmentModal', false);
        });
    }

    const documentUploadForm = document.getElementById('documentUploadForm');
    if (documentUploadForm) {
        documentUploadForm.addEventListener('submit', function(event) {
            event.preventDefault();
            if (!currentUser) { showAlert("You must be logged in to submit documents."); return; }
            let documents = getDocuments();
            const newDocument = { id: 'doc-' + Date.now(), vendorId: currentUser.id, type: document.getElementById('docType').value, number: document.getElementById('docNumber').value, expiry: document.getElementById('docExpiry').value, status: 'Pending', rejectionReason: null };
            documents.push(newDocument);
            saveDocuments(documents);
            renderVendorDashboard();
            this.reset();
            toggleModal('documentModal', false);
            showAlert('Your document has been submitted for approval.');
        });
    }

    const completionForm = document.getElementById('completionForm');
    if (completionForm) {
        completionForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const shipmentId = document.getElementById('completionShipmentId').value;
            const completionDate = document.getElementById('completionDate').value;
            if (!document.getElementById('deliveryOtp').value || !completionDate) { showAlert('Please enter the completion date and OTP.'); return; }
            let shipments = getShipments();
            let notifications = getNotifications();
            const shipmentIndex = shipments.findIndex(s => s.id === shipmentId);
            if (shipmentIndex > -1) {
                shipments[shipmentIndex].status = 'Delivered';
                shipments[shipmentIndex].completionDate = completionDate;
                const managerNotification = { id: 'notif-' + Date.now(), recipientRole: 'manager', message: `Shipment ${shipmentId} completed by ${currentUser.name}.`, read: false };
                notifications.push(managerNotification);
                saveShipments(shipments);
                saveNotifications(notifications);
                renderVendorDashboard();
                this.reset();
                toggleModal('completionModal', false);
                showAlert('Shipment marked as complete!');
            }
        });
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const name = document.getElementById('newUserName').value;
            const role = document.getElementById('newUserRole').value;

            if (!name.trim()) {
                showAlert('User name cannot be empty.');
                return;
            }

            let users = getUsers();
            const newUser = {
                id: `${role}-user-${Date.now()}`,
                name: name,
                email: `${name.trim().toLowerCase().replace(/\s/g, '.')}@log.com`,
                role: role
            };
            users.push(newUser);
            saveUsers(users);
            renderUserList();
            this.reset();
            toggleModal('addUserModal', false);
            showAlert('User added successfully.');
        });
    }

    const rejectionForm = document.getElementById('rejectionForm');
    if (rejectionForm) {
        rejectionForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const docId = document.getElementById('rejectionDocId').value;
            const reason = document.getElementById('rejectionReason').value;

            if (reason) {
                let documents = getDocuments();
                let notifications = getNotifications();
                const docIndex = documents.findIndex(d => d.id === docId);

                if (docIndex > -1) {
                    documents[docIndex].status = 'Rejected';
                    documents[docIndex].rejectionReason = reason;
                    
                    const newNotification = { 
                        id: 'notif-' + Date.now(), 
                        recipientId: documents[docIndex].vendorId, 
                        message: `Your document (${documents[docIndex].type}) was rejected. Reason: ${reason}`, 
                        read: false 
                    };
                    notifications.push(newNotification);

                    saveDocuments(documents);
                    saveNotifications(notifications);
                    renderAdminDashboard();
                    
                    this.reset();
                    toggleModal('rejectionModal', false);
                }
            }
        });
    }
});

// --- Global Initializer ---
initializeData();
