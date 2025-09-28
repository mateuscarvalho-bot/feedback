// Default subjects data
const defaultSubjects = [
    { "id": 1, "nome": "Cardiologia", "especialidade": "Clínica", "assuntos": ["Arritmias", "Insuficiência Cardíaca", "Coronariopatias", "Hipertensão", "Valvopatias"], "custom": false },
    { "id": 2, "nome": "Pneumologia", "especialidade": "Clínica", "assuntos": ["Asma", "DPOC", "Pneumonias", "Derrame Pleural", "Embolia Pulmonar"], "custom": false },
    { "id": 3, "nome": "Gastroenterologia", "especialidade": "Clínica", "assuntos": ["DRGE", "Úlcera Péptica", "Hepatites", "Cirrose", "Pancreatite"], "custom": false },
    { "id": 4, "nome": "Neurologia", "especialidade": "Clínica", "assuntos": ["AVC", "Epilepsia", "Cefaléias", "Demências", "Parkinson"], "custom": false },
    { "id": 5, "nome": "Endocrinologia", "especialidade": "Clínica", "assuntos": ["Diabetes", "Tireoidopatias", "Obesidade", "Osteoporose", "Adrenal"], "custom": false },
    { "id": 6, "nome": "Ortopedia", "especialidade": "Cirúrgica", "assuntos": ["Fraturas", "Artrose", "Meniscopatias", "Luxações", "Tendinites"], "custom": false },
    { "id": 7, "nome": "Cirurgia Geral", "especialidade": "Cirúrgica", "assuntos": ["Apendicite", "Hérnias", "Vesícula", "Trauma", "Abdome Agudo"], "custom": false },
    { "id": 8, "nome": "Ginecologia", "especialidade": "Cirúrgica", "assuntos": ["Miomas", "Cistos", "Endometriose", "Câncer Ginecológico", "Gravidez"], "custom": false },
    { "id": 9, "nome": "Urologia", "especialidade": "Cirúrgica", "assuntos": ["Cálculos", "ITU", "Câncer Urológico", "Disfunções", "Próstata"], "custom": false },
    { "id": 10, "nome": "Pediatria", "especialidade": "Clínica", "assuntos": ["Crescimento", "Vacinação", "Infecções", "Alergias", "Desenvolvimento"], "custom": false }
];

// Storage utilities
class Storage {
    static getStudies() {
        const studies = localStorage.getItem('enare_studies');
        return studies ? JSON.parse(studies) : [];
    }

    static saveStudies(studies) {
        localStorage.setItem('enare_studies', JSON.stringify(studies));
    }

    static getScheduledReviews() {
        const reviews = localStorage.getItem('enare_reviews');
        return reviews ? JSON.parse(reviews) : [];
    }

    static saveScheduledReviews(reviews) {
        localStorage.setItem('enare_reviews', JSON.stringify(reviews));
    }

    static getSubjects() {
        const savedSubjects = localStorage.getItem('enare_subjects');
        if (savedSubjects) {
            const parsed = JSON.parse(savedSubjects);
            // Merge with default subjects, keeping custom ones
            const defaultIds = defaultSubjects.map(s => s.id);
            const customSubjects = parsed.filter(s => !defaultIds.includes(s.id));
            return [...defaultSubjects, ...customSubjects];
        }
        return defaultSubjects;
    }

    static saveSubjects(subjectsToSave) {
        localStorage.setItem('enare_subjects', JSON.stringify(subjectsToSave));
    }

    static addSubject(subject) {
        const subjects = this.getSubjects();
        const newId = Math.max(...subjects.map(s => s.id), 0) + 1;
        const newSubject = { ...subject, id: newId, custom: true };
        subjects.push(newSubject);
        this.saveSubjects(subjects);
        return newSubject;
    }

    static deleteSubject(subjectId) {
        const subjects = this.getSubjects();
        const updatedSubjects = subjects.filter(s => s.id !== subjectId);
        this.saveSubjects(updatedSubjects);
    }

    static addStudy(study) {
        const studies = this.getStudies();
        
        // Clean up completed reviews before adding new study
        const hadMatchingReview = this.cleanupCompletedReviews(study);
        
        studies.push(study);
        this.saveStudies(studies);
        
        // Schedule new review
        this.scheduleReview(study);
        
        return hadMatchingReview;
    }

    static cleanupCompletedReviews(newStudy) {
        const reviews = this.getScheduledReviews();
        const studyDate = new Date(newStudy.date);
        
        // Find reviews related to the current study (±3 days tolerance)
        const completedReviews = reviews.filter(review => {
            const reviewDate = new Date(review.scheduledDate);
            const timeDiff = Math.abs(reviewDate - studyDate);
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
            
            return review.subjectId === newStudy.subjectId &&
                   review.topic === newStudy.topic &&
                   daysDiff <= 3;
        });
        
        // Remove completed reviews
        const remainingReviews = reviews.filter(review => 
            !completedReviews.some(completed => completed.id === review.id)
        );
        
        this.saveScheduledReviews(remainingReviews);
        
        return completedReviews.length > 0;
    }

    static scheduleReview(study) {
        const reviews = this.getScheduledReviews();
        const nextReviewDate = calculateNextReview(study.date, study.performance);
        
        const newReview = {
            id: Date.now() + Math.random(),
            subjectId: study.subjectId,
            subjectName: study.subjectName,
            topic: study.topic,
            scheduledDate: nextReviewDate,
            originalStudyId: study.id
        };
        
        reviews.push(newReview);
        this.saveScheduledReviews(reviews);
    }

    static deleteStudy(studyId) {
        const studies = this.getStudies().filter(s => s.id !== studyId);
        this.saveStudies(studies);
    }

    static clearOverdueReviews() {
        const reviews = this.getScheduledReviews();
        const today = new Date().toISOString().split('T')[0];
        const futureReviews = reviews.filter(review => review.scheduledDate >= today);
        this.saveScheduledReviews(futureReviews);
    }
}

// App state
let currentTab = 'inicio';
let performanceChart = null;
let evolutionChart = null;
let deleteItemId = null;
let deleteItemType = null;

// Navigation system
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = e.target.closest('.nav-link').getAttribute('data-tab');
            if (tab) {
                switchTab(tab);
            }
        });
    });
}

function switchTab(tabName) {
    // Update navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-tab') === tabName) {
            link.classList.add('active');
        }
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    currentTab = tabName;

    // Load tab-specific content
    switch (tabName) {
        case 'inicio':
            updateDashboard();
            break;
        case 'estudar':
            setupStudyForm();
            break;
        case 'cronograma':
            updateSchedule();
            break;
        case 'historico':
            updateHistory();
            break;
        case 'configuracoes':
            setupConfigurationsTab();
            break;
    }
}

// Study form functionality
function setupStudyForm() {
    const subjectSelect = document.getElementById('subject');
    const topicSelect = document.getElementById('topic');
    const customTopicGroup = document.getElementById('customTopicGroup');
    const dateInput = document.getElementById('date');
    const reviewAlert = document.getElementById('reviewAlert');
    
    // Populate subjects dropdown
    populateSubjects();
    
    // Set default date
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Hide review alert initially
    if (reviewAlert) {
        reviewAlert.classList.add('hidden');
    }

    // Hide custom topic initially
    if (customTopicGroup) {
        customTopicGroup.style.display = 'none';
    }
}

function populateSubjects() {
    const subjectSelect = document.getElementById('subject');
    if (!subjectSelect) return;

    // Clear existing options
    subjectSelect.innerHTML = '<option value="">Selecione uma disciplina</option>';
    
    // Get all subjects
    const allSubjects = Storage.getSubjects();
    
    // Add each subject as option
    allSubjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.id;
        option.textContent = `${subject.nome} (${subject.especialidade})`;
        subjectSelect.appendChild(option);
    });
}

function handleSubjectChange(e) {
    const subjectId = parseInt(e.target.value);
    const allSubjects = Storage.getSubjects();
    const subject = allSubjects.find(s => s.id === subjectId);
    const topicSelect = document.getElementById('topic');
    
    // Clear topic dropdown
    topicSelect.innerHTML = '<option value="">Selecione um assunto</option>';
    
    if (subject && subject.assuntos) {
        // Add topics for selected subject
        subject.assuntos.forEach(assunto => {
            const option = document.createElement('option');
            option.value = assunto;
            option.textContent = assunto;
            topicSelect.appendChild(option);
        });
        
        // Add "Outro" option
        const otherOption = document.createElement('option');
        otherOption.value = 'outro';
        otherOption.textContent = 'Outro (especificar)';
        topicSelect.appendChild(otherOption);
    }
    
    // Check for matching reviews
    checkForMatchingReview();
}

function handleTopicChange(e) {
    const customTopicGroup = document.getElementById('customTopicGroup');
    const customTopicInput = document.getElementById('customTopic');
    
    if (e.target.value === 'outro') {
        customTopicGroup.style.display = 'block';
        customTopicInput.required = true;
    } else {
        customTopicGroup.style.display = 'none';
        customTopicInput.required = false;
        customTopicInput.value = '';
    }
    
    // Check for matching reviews
    checkForMatchingReview();
}

function checkForMatchingReview() {
    const subjectId = parseInt(document.getElementById('subject').value);
    const topicValue = document.getElementById('topic').value;
    const customTopic = document.getElementById('customTopic').value;
    const reviewAlert = document.getElementById('reviewAlert');
    
    if (!subjectId || !topicValue || (topicValue === 'outro' && !customTopic)) {
        reviewAlert.classList.add('hidden');
        return;
    }
    
    const topic = topicValue === 'outro' ? customTopic.trim() : topicValue;
    const reviews = Storage.getScheduledReviews();
    const today = new Date();
    
    const matchingReview = reviews.find(review => {
        const reviewDate = new Date(review.scheduledDate);
        const daysDiff = Math.abs(reviewDate - today) / (1000 * 60 * 60 * 24);
        
        return review.subjectId === subjectId &&
               review.topic === topic &&
               daysDiff <= 3;
    });
    
    if (matchingReview) {
        reviewAlert.classList.remove('hidden');
    } else {
        reviewAlert.classList.add('hidden');
    }
}

function handleStudySubmit(e) {
    e.preventDefault();
    
    const subjectId = parseInt(document.getElementById('subject').value);
    const correct = parseInt(document.getElementById('correct').value);
    const total = parseInt(document.getElementById('total').value);
    const topicValue = document.getElementById('topic').value;
    const customTopic = document.getElementById('customTopic').value;
    const date = document.getElementById('date').value;
    const observations = document.getElementById('observations').value.trim();

    // Validation
    if (!subjectId || !topicValue || (topicValue === 'outro' && !customTopic.trim()) ||
        isNaN(correct) || isNaN(total) || correct < 0 || total < 1 || correct > total || !date) {
        showToast('Por favor, preencha todos os campos corretamente', 'error');
        return;
    }

    const allSubjects = Storage.getSubjects();
    const subject = allSubjects.find(s => s.id === subjectId);
    const topic = topicValue === 'outro' ? customTopic.trim() : topicValue;
    const percentage = Math.round((correct / total) * 100);
    const performance = getPerformance(percentage);

    const study = {
        id: Date.now(),
        subjectId,
        subjectName: subject.nome,
        topic,
        correct,
        total,
        percentage,
        date,
        performance,
        observations
    };

    const hadMatchingReview = Storage.addStudy(study);
    
    showToast(hadMatchingReview ? 'Estudo registrado! Revisão anterior removida do cronograma.' : 'Estudo registrado com sucesso!', 'success');
    
    // Reset form
    resetStudyForm();
    updateReviewBadge();
}

function resetStudyForm() {
    const form = document.getElementById('studyForm');
    const dateInput = document.getElementById('date');
    const customTopicGroup = document.getElementById('customTopicGroup');
    const topicSelect = document.getElementById('topic');
    const reviewAlert = document.getElementById('reviewAlert');
    
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    customTopicGroup.style.display = 'none';
    topicSelect.innerHTML = '<option value="">Selecione primeiro uma disciplina</option>';
    reviewAlert.classList.add('hidden');
}

function getPerformance(percentage) {
    if (percentage >= 90) return 'excelente';
    if (percentage >= 75) return 'bom';
    if (percentage >= 60) return 'regular';
    return 'fraco';
}

function calculateNextReview(date, performance) {
    const reviewDate = new Date(date);
    const daysToAdd = {
        'excelente': 14,
        'bom': 7,
        'regular': 4,
        'fraco': 2
    };
    
    reviewDate.setDate(reviewDate.getDate() + daysToAdd[performance]);
    return reviewDate.toISOString().split('T')[0];
}

// Dashboard functionality
function updateDashboard() {
    const studies = Storage.getStudies();
    const reviews = Storage.getScheduledReviews();
    
    // Update stats
    updateStats(studies, reviews);
    
    // Update charts
    updateCharts(studies);
    
    // Update review badge
    updateReviewBadge();
}

function updateStats(studies, reviews) {
    const totalStudies = studies.length;
    const totalQuestions = studies.reduce((sum, study) => sum + study.total, 0);
    const totalCorrect = studies.reduce((sum, study) => sum + study.correct, 0);
    const averageScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    const pendingReviews = reviews.length;

    document.getElementById('totalStudies').textContent = totalStudies;
    document.getElementById('averageScore').textContent = `${averageScore}%`;
    document.getElementById('pendingReviews').textContent = pendingReviews;
    document.getElementById('totalQuestions').textContent = totalQuestions;
}

function updateCharts(studies) {
    updatePerformanceChart(studies);
    updateEvolutionChart(studies);
}

function updatePerformanceChart(studies) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    if (performanceChart) {
        performanceChart.destroy();
    }

    const subjectData = {};
    studies.forEach(study => {
        if (!subjectData[study.subjectName]) {
            subjectData[study.subjectName] = { correct: 0, total: 0 };
        }
        subjectData[study.subjectName].correct += study.correct;
        subjectData[study.subjectName].total += study.total;
    });

    const labels = Object.keys(subjectData);
    const data = labels.map(subject => {
        return subjectData[subject].total > 0 ? Math.round((subjectData[subject].correct / subjectData[subject].total) * 100) : 0;
    });

    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Aproveitamento (%)',
                data,
                backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function updateEvolutionChart(studies) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    
    if (evolutionChart) {
        evolutionChart.destroy();
    }

    const sortedStudies = [...studies].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = sortedStudies.map(study => formatDate(study.date));
    const data = sortedStudies.map(study => study.percentage);

    evolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Aproveitamento (%)',
                data,
                borderColor: '#1FB8CD',
                backgroundColor: 'rgba(31, 184, 205, 0.1)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Schedule functionality
function updateSchedule() {
    const reviews = Storage.getScheduledReviews();
    const today = new Date().toISOString().split('T')[0];
    
    // Sort reviews by date
    const sortedReviews = reviews.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    
    // Count reviews by status
    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    
    const reviewItems = sortedReviews.map(review => {
        const status = getReviewStatus(review.scheduledDate, today);
        if (status === 'overdue') overdueCount++;
        else if (status === 'today') todayCount++;
        else upcomingCount++;
        
        return { ...review, status };
    });

    // Update stats
    document.getElementById('overdueCount').textContent = overdueCount;
    document.getElementById('todayCount').textContent = todayCount;
    document.getElementById('upcomingCount').textContent = upcomingCount;

    const scheduleList = document.getElementById('scheduleList');

    if (reviewItems.length === 0) {
        scheduleList.innerHTML = `
            <div class="empty-state">
                <h3>📚 Nenhuma revisão agendada</h3>
                <p>Registre estudos para gerar cronograma de revisões automático</p>
            </div>
        `;
    } else {
        scheduleList.innerHTML = reviewItems.map(item => `
            <div class="schedule-item ${item.status}">
                <div class="schedule-info">
                    <h4>${item.subjectName} - ${item.topic}</h4>
                    <p>Agendada para revisão ${item.status === 'overdue' ? '(atrasada)' : item.status === 'today' ? '(hoje)' : ''}</p>
                </div>
                <div class="schedule-date">
                    ${formatDate(item.scheduledDate)}
                </div>
            </div>
        `).join('');
    }

    // Add event listeners for schedule controls
    const updateBtn = document.getElementById('updateSchedule');
    const clearBtn = document.getElementById('clearOverdue');
    
    if (updateBtn) {
        updateBtn.onclick = () => {
            updateSchedule();
            showToast('Cronograma atualizado!', 'info');
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            Storage.clearOverdueReviews();
            updateSchedule();
            updateReviewBadge();
            showToast('Revisões atrasadas removidas!', 'warning');
        };
    }
}

function getReviewStatus(reviewDate, today) {
    if (reviewDate < today) return 'overdue';
    if (reviewDate === today) return 'today';
    return 'upcoming';
}

function updateReviewBadge() {
    const reviews = Storage.getScheduledReviews();
    const badge = document.getElementById('reviewBadge');
    if (badge) {
        badge.textContent = reviews.length;
        if (reviews.length > 0) {
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }
}

// History functionality
function updateHistory() {
    initHistoryFilters();
    renderHistory();
}

function initHistoryFilters() {
    const studies = Storage.getStudies();
    const filterSubject = document.getElementById('filterSubject');
    const filterTopic = document.getElementById('filterTopic');

    if (!filterSubject || !filterTopic) return;

    // Populate subject filter
    const subjects = [...new Set(studies.map(s => s.subjectName))];
    filterSubject.innerHTML = '<option value="">Todas as disciplinas</option>';
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject;
        option.textContent = subject;
        filterSubject.appendChild(option);
    });

    // Populate topic filter
    const topics = [...new Set(studies.map(s => s.topic))];
    filterTopic.innerHTML = '<option value="">Todos os assuntos</option>';
    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        filterTopic.appendChild(option);
    });

    // Add event listeners
    filterSubject.addEventListener('change', renderHistory);
    filterTopic.addEventListener('change', renderHistory);
    
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            filterSubject.value = '';
            filterTopic.value = '';
            renderHistory();
        });
    }
}

function renderHistory() {
    const studies = Storage.getStudies();
    const filterSubject = document.getElementById('filterSubject').value;
    const filterTopic = document.getElementById('filterTopic').value;

    let filteredStudies = studies;

    if (filterSubject) {
        filteredStudies = filteredStudies.filter(s => s.subjectName === filterSubject);
    }

    if (filterTopic) {
        filteredStudies = filteredStudies.filter(s => s.topic === filterTopic);
    }

    // Sort by date (newest first)
    filteredStudies.sort((a, b) => new Date(b.date) - new Date(a.date));

    const historyList = document.getElementById('historyList');

    if (filteredStudies.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <h3>Nenhum estudo encontrado</h3>
                <p>Registre seus primeiros estudos na aba Estudar</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = filteredStudies.map(study => `
        <div class="history-item">
            <button class="delete-btn" onclick="deleteItem(${study.id}, 'study')">🗑️</button>
            <div class="history-header">
                <div class="history-info">
                    <h4>
                        ${study.subjectName} - ${study.topic}
                        <span class="performance-badge performance-${study.performance}">
                            ${study.performance}
                        </span>
                    </h4>
                    <p>${study.correct}/${study.total} questões</p>
                </div>
                <div class="history-meta">
                    <div class="history-date">${formatDate(study.date)}</div>
                    <div class="score-display">${study.percentage}%</div>
                </div>
            </div>
            ${study.observations ? `
                <div class="history-observations">
                    ${study.observations}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Configurations functionality
function setupConfigurationsTab() {
    initImportExport();
    initSubjectManagement();
    updateAllSubjectsList();
}

function initImportExport() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    
    if (exportBtn) {
        exportBtn.onclick = exportData;
    }
    
    if (importBtn && importFile) {
        importBtn.onclick = () => importFile.click();
        importFile.onchange = importData;
    }
}

function initSubjectManagement() {
    const addSubjectForm = document.getElementById('addSubjectForm');
    
    if (addSubjectForm) {
        addSubjectForm.addEventListener('submit', handleAddSubject);
    }
}

function handleAddSubject(e) {
    e.preventDefault();
    
    const name = document.getElementById('newSubjectName').value.trim();
    const specialty = document.getElementById('newSubjectSpecialty').value;
    const topicsText = document.getElementById('newSubjectTopics').value.trim();
    
    if (!name || !specialty || !topicsText) {
        showToast('Por favor, preencha todos os campos', 'error');
        return;
    }
    
    const topics = topicsText.split(',').map(t => t.trim()).filter(t => t);
    
    if (topics.length === 0) {
        showToast('Por favor, adicione pelo menos um assunto', 'error');
        return;
    }
    
    // Check if subject already exists
    const existingSubjects = Storage.getSubjects();
    if (existingSubjects.some(s => s.nome.toLowerCase() === name.toLowerCase())) {
        showToast('Disciplina já existe', 'error');
        return;
    }
    
    const newSubject = {
        nome: name,
        especialidade: specialty,
        assuntos: topics
    };
    
    Storage.addSubject(newSubject);
    showToast('Disciplina adicionada com sucesso!', 'success');
    
    // Reset form and update displays
    e.target.reset();
    updateAllSubjectsList();
    populateSubjects(); // Update study form dropdowns
}

function updateAllSubjectsList() {
    const allSubjects = Storage.getSubjects();
    const container = document.getElementById('allSubjectsList');
    
    if (!container) return;
    
    container.innerHTML = allSubjects.map(subject => `
        <div class="subject-card ${subject.custom ? 'custom' : ''}">
            ${subject.custom ? `<button class="subject-delete-btn" onclick="deleteItem(${subject.id}, 'subject')">🗑️</button>` : ''}
            <div class="subject-header">
                <div>
                    <div class="subject-name">${subject.nome}</div>
                    <div class="subject-specialty">${subject.especialidade}</div>
                </div>
            </div>
            <div class="subject-topics">
                ${subject.assuntos.map(topic => `
                    <span class="topic-tag">${topic}</span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Delete functionality
function deleteItem(itemId, type) {
    deleteItemId = itemId;
    deleteItemType = type;
    
    const modal = document.getElementById('deleteModal');
    const message = document.getElementById('deleteMessage');
    
    if (type === 'study') {
        message.textContent = 'Tem certeza que deseja excluir este estudo? Esta ação não pode ser desfeita.';
    } else if (type === 'subject') {
        message.textContent = 'Tem certeza que deseja excluir esta disciplina personalizada? Esta ação não pode ser desfeita.';
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('show');
}

function initModal() {
    const modal = document.getElementById('deleteModal');
    const cancelBtn = document.getElementById('cancelDelete');
    const confirmBtn = document.getElementById('confirmDelete');
    
    if (!modal || !cancelBtn || !confirmBtn) return;
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 200);
    });
    
    confirmBtn.addEventListener('click', () => {
        if (deleteItemType === 'study') {
            Storage.deleteStudy(deleteItemId);
            renderHistory();
            updateDashboard();
            showToast('Estudo excluído com sucesso!', 'success');
        } else if (deleteItemType === 'subject') {
            Storage.deleteSubject(deleteItemId);
            updateAllSubjectsList();
            populateSubjects();
            showToast('Disciplina excluída com sucesso!', 'success');
        }
        
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 200);
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 200);
        }
    });
}

// Import/Export functionality
function exportData() {
    const studies = Storage.getStudies();
    const reviews = Storage.getScheduledReviews();
    const subjects = Storage.getSubjects();
    
    const dataToExport = {
        studies,
        reviews,
        subjects,
        exportDate: new Date().toISOString(),
        version: '2.0'
    };
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `enare_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showToast('Dados exportados com sucesso!', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            if (importedData.version && importedData.studies) {
                Storage.saveStudies(importedData.studies || []);
                Storage.saveScheduledReviews(importedData.reviews || []);
                if (importedData.subjects) {
                    Storage.saveSubjects(importedData.subjects);
                }
            } else if (Array.isArray(importedData)) {
                Storage.saveStudies(importedData);
                Storage.saveScheduledReviews([]);
            } else {
                showToast('Formato de arquivo inválido', 'error');
                return;
            }
            
            showToast('Dados importados com sucesso!', 'success');
            updateDashboard();
            updateHistory();
            updateSchedule();
            updateAllSubjectsList();
            updateReviewBadge();
        } catch (error) {
            showToast('Erro ao importar arquivo', 'error');
        }
    };
    reader.readAsText(file);
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initModal();
    
    // Add event listeners for study form
    const subjectSelect = document.getElementById('subject');
    const topicSelect = document.getElementById('topic');
    const customTopicInput = document.getElementById('customTopic');
    const studyForm = document.getElementById('studyForm');
    
    if (subjectSelect) {
        subjectSelect.addEventListener('change', handleSubjectChange);
    }
    
    if (topicSelect) {
        topicSelect.addEventListener('change', handleTopicChange);
    }
    
    if (customTopicInput) {
        customTopicInput.addEventListener('input', checkForMatchingReview);
    }
    
    if (studyForm) {
        studyForm.addEventListener('submit', handleStudySubmit);
    }
    
    // Initialize with sample data if no data exists
    const existingStudies = Storage.getStudies();
    if (existingStudies.length === 0) {
        const sampleData = [
            {
                "id": 1640995200000,
                "subjectId": 1,
                "subjectName": "Cardiologia",
                "topic": "Arritmias",
                "correct": 8,
                "total": 10,
                "percentage": 80,
                "date": "2024-01-15",
                "performance": "bom",
                "observations": "Tive dificuldade com os casos de FA com RVR"
            },
            {
                "id": 1641081600000,
                "subjectId": 2,
                "subjectName": "Pneumologia",
                "topic": "Pneumonias",
                "correct": 9,
                "total": 10,
                "percentage": 90,
                "date": "2024-01-16",
                "performance": "excelente",
                "observations": ""
            }
        ];
        Storage.saveStudies(sampleData);
        
        // Create sample reviews
        const sampleReviews = [
            {
                "id": 2001,
                "subjectId": 1,
                "subjectName": "Cardiologia",
                "topic": "Arritmias",
                "scheduledDate": "2024-01-22",
                "originalStudyId": 1640995200000
            }
        ];
        Storage.saveScheduledReviews(sampleReviews);
    }
    
    // Load initial tab
    switchTab('inicio');
    
    // Update review badge
    updateReviewBadge();
});

// Make deleteItem available globally
window.deleteItem = deleteItem;