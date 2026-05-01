let db;
let currentSubjectId = null;
let currentTopicId = null;
let studyData = JSON.parse(localStorage.getItem('study_pro_data')) || { subjects: [] };

// Iniciar Banco de Dados para arquivos
const request = indexedDB.open("StudyFilesDB", 1);
request.onupgradeneeded = e => e.target.result.createObjectStore("files");
request.onsuccess = e => {
    db = e.target.result;
    render();
};

function save() {
    localStorage.setItem('study_pro_data', JSON.stringify(studyData));
    render();
}

// --- FUNÇÕES DE EXCLUIR (O QUE VOCÊ PEDIU) ---

// 1. Apagar um PDF específico
function deleteFile(subjectId, topicId, fileId, event) {
    event.stopPropagation(); // Não deixa abrir o PDF ao clicar na lixeira
    if (confirm("Deseja apagar este arquivo PDF permanentemente?")) {
        const sub = studyData.subjects.find(s => s.id === subjectId);
        const top = sub.topics.find(t => t.id === topicId);
        
        // Remove da lista
        top.files = top.files.filter(f => f.id !== fileId);

        // Remove do banco de dados pesado (IndexedDB)
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(fileId);

        save();
    }
}

// 2. Apagar um Tópico inteiro
function deleteTopic(subjectId, topicId) {
    if (confirm("Apagar este tópico e todos os arquivos dentro dele?")) {
        const sub = studyData.subjects.find(s => s.id === subjectId);
        const top = sub.topics.find(t => t.id === topicId);

        // Limpa os arquivos do tópico do IndexedDB antes de apagar o tópico
        top.files.forEach(f => {
            const tx = db.transaction("files", "readwrite");
            tx.objectStore("files").delete(f.id);
        });

        sub.topics = sub.topics.filter(t => t.id !== topicId);
        save();
    }
}

// 3. Apagar uma Matéria
function deleteSubject(id, event) {
    event.stopPropagation();
    if (confirm("Apagar esta matéria completa? Isso removerá todos os tópicos e arquivos nela.")) {
        studyData.subjects = studyData.subjects.filter(s => s.id !== id);
        if (currentSubjectId === id) currentSubjectId = null;
        save();
    }
}

// --- RESTO DAS FUNÇÕES ---

function createNewSubject() {
    const nome = prompt("Nome da Matéria:");
    if (nome) {
        studyData.subjects.push({ id: Date.now(), name: nome, topics: [] });
        save();
    }
}

function addTopic(subId) {
    const nome = prompt("Nome do Tópico:");
    if (nome) {
        const sub = studyData.subjects.find(s => s.id === subId);
        sub.topics.push({ id: Date.now(), name: nome, files: [] });
        save();
    }
}

function triggerFile(subId, topId) {
    currentSubjectId = subId;
    currentTopicId = topId;
    document.getElementById('global-file-input').click();
}

document.getElementById('global-file-input').onchange = e => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;

    const fileId = "file_" + Date.now();
    const reader = new FileReader();
    reader.onload = () => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(reader.result, fileId);
        const sub = studyData.subjects.find(s => s.id === currentSubjectId);
        const top = sub.topics.find(t => t.id === currentTopicId);
        top.files.push({ id: fileId, name: file.name });
        save();
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // Reseta o input
};

function openFile(fileId, fileName) {
    const tx = db.transaction("files", "readonly");
    const req = tx.objectStore("files").get(fileId);
    req.onsuccess = () => {
        const blob = new Blob([req.result], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        document.getElementById('pdf-name-display').innerText = fileName;
        document.getElementById('pdf-frame').src = url;
        document.getElementById('pdf-viewer').style.display = 'block';
    };
}

function closeViewer() {
    document.getElementById('pdf-viewer').style.display = 'none';
    document.getElementById('pdf-frame').src = '';
}

function render() {
    const list = document.getElementById('subject-list');
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    list.innerHTML = '';
    
    studyData.subjects.forEach(sub => {
        const activeClass = currentSubjectId === sub.id ? 'active' : '';
        list.innerHTML += `
            <li class="subject-item ${activeClass}" onclick="selectSubject(${sub.id})">
                <span><i class="ri-folder-fill"></i> ${sub.name}</span>
                <i class="ri-delete-bin-6-line delete-icon" onclick="deleteSubject(${sub.id}, event)"></i>
            </li>
        `;
    });

    const grid = document.getElementById('topics-grid');
    const empty = document.getElementById('empty-state');

    if (currentSubjectId) {
        const sub = studyData.subjects.find(s => s.id === currentSubjectId);
        document.getElementById('view-title').innerText = sub.name;
        empty.style.display = 'none';
        grid.style.display = 'grid';
        grid.innerHTML = `
            <div class="topic-card" style="border: 2px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; cursor:pointer" onclick="addTopic(${sub.id})">
                <strong style="color:#64748b">+ Novo Tópico</strong>
            </div>
        `;
        
        sub.topics.forEach(top => {
            const filteredFiles = top.files.filter(f => f.name.toLowerCase().includes(searchTerm));
            
            grid.innerHTML += `
                <div class="topic-card">
                    <div class="topic-header">
                        <h3>${top.name}</h3>
                        <i class="ri-delete-bin-line btn-del-topic" onclick="deleteTopic(${sub.id}, ${top.id})"></i>
                    </div>
                    <div class="file-list">
                        ${filteredFiles.map(f => `
                            <div class="file-item">
                                <div class="file-info" onclick="openFile('${f.id}', '${f.name}')">
                                    <i class="ri-file-pdf-fill" style="color:#f43f5e"></i> 
                                    <span>${f.name}</span>
                                </div>
                                <i class="ri-close-circle-line btn-del-file" onclick="deleteFile(${sub.id}, ${top.id}, '${f.id}', event)"></i>
                            </div>
                        `).join('')}
                    </div>
                    <button class="upload-btn" onclick="triggerFile(${sub.id}, ${top.id})">Subir PDF</button>
                </div>
            `;
        });
    } else {
        empty.style.display = 'block';
        grid.style.display = 'none';
        document.getElementById('view-title').innerText = 'Bem-vindo';
    }
}

function selectSubject(id) {
    currentSubjectId = id;
    render();
}

// Iniciar app
setTimeout(render, 100);
