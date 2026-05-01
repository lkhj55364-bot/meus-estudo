// Banco de dados super simples usando nomes fáceis
let db;
let currentSubjectId = null;
let currentTopicId = null;
let studyData = JSON.parse(localStorage.getItem('study_pro_data')) || { subjects: [] };

// Iniciar Banco de Dados para Arquivos Pesados
const request = indexedDB.open("StudyFilesDB", 1);
request.onupgradeneeded = e => e.target.result.createObjectStore("files");
request.onsuccess = e => db = e.target.result;

function save() {
    localStorage.setItem('study_pro_data', JSON.stringify(studyData));
    render();
}

function createNewSubject() {
    const nome = prompt("Nome da Matéria (ex: Português):");
    if (nome) {
        studyData.subjects.push({ id: Date.now(), name: nome, topics: [] });
        save();
    }
}

function deleteSubject(id, e) {
    e.stopPropagation();
    if(confirm("Excluir matéria?")) {
        studyData.subjects = studyData.subjects.filter(s => s.id !== id);
        currentSubjectId = null;
        save();
    }
}

function addTopic(subId) {
    const nome = prompt("Nome do Tópico (ex: Gramática):");
    if (nome) {
        const sub = studyData.subjects.find(s => s.id === subId);
        sub.topics.push({ id: Date.now(), name: nome, files: [] });
        save();
    }
}

// Lógica de Arquivos
function triggerFile(subId, topId) {
    currentSubjectId = subId;
    currentTopicId = topId;
    document.getElementById('global-file-input').click();
}

document.getElementById('global-file-input').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const fileId = "file_" + Date.now();
    const reader = new FileReader();
    
    reader.onload = () => {
        // Salva o arquivo real no banco pesado (IndexedDB)
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(reader.result, fileId);

        // Salva a referência na lista
        const sub = studyData.subjects.find(s => s.id === currentSubjectId);
        const top = sub.topics.find(t => t.id === currentTopicId);
        top.files.push({ id: fileId, name: file.name });
        
        save();
    };
    reader.readAsArrayBuffer(file);
};

function openFile(fileId, fileName) {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").get(fileId);
    
    request.onsuccess = () => {
        const blob = new Blob([request.result], { type: 'application/pdf' });
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
    list.innerHTML = '';
    
    studyData.subjects.forEach(sub => {
        const activeClass = currentSubjectId === sub.id ? 'active' : '';
        list.innerHTML += `
            <li class="subject-item ${activeClass}" onclick="showSubject(${sub.id})">
                <span><i class="ri-folder-fill"></i> ${sub.name}</span>
                <i class="ri-delete-bin-line" onclick="deleteSubject(${sub.id}, event)"></i>
            </li>
        `;
    });

    if (currentSubjectId) {
        const sub = studyData.subjects.find(s => s.id === currentSubjectId);
        document.getElementById('view-title').innerText = sub.name;
        document.getElementById('empty-state').style.display = 'none';
        const grid = document.getElementById('topics-grid');
        grid.style.display = 'grid';
        grid.innerHTML = `
            <div class="topic-card" style="border: 2px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; cursor:pointer" onclick="addTopic(${sub.id})">
                <strong>+ Novo Tópico</strong>
            </div>
        `;
        
        sub.topics.forEach(top => {
            grid.innerHTML += `
                <div class="topic-card">
                    <h3>${top.name} <i class="ri-bookmark-line"></i></h3>
                    <div class="file-list">
                        ${top.files.map(f => `
                            <div class="file-item" onclick="openFile('${f.id}', '${f.name}')">
                                <span><i class="ri-file-pdf-line"></i> ${f.name}</span>
                                <i class="ri-eye-line"></i>
                            </div>
                        `).join('')}
                    </div>
                    <button class="upload-btn" onclick="triggerFile(${sub.id}, ${top.id})">Subir PDF</button>
                </div>
            `;
        });
    }
}

function showSubject(id) {
    currentSubjectId = id;
    render();
}

// Iniciar
setTimeout(render, 100);