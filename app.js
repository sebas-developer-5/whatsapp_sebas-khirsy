let searchResults = [];
let currentIndex = 0;

const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const searchNav = document.getElementById('search-nav');
const searchCounter = document.getElementById('search-counter');

console.log('Script JS caricato');

let messages = [];

const messagesDiv = document.getElementById('messages');
const stickyDate = document.getElementById('sticky-date');
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search-input');
const chatContainer = document.querySelector('.chat-container');

function displayMessages(msgs) {
    messagesDiv.innerHTML = '';

    msgs.forEach((msg, index) => {

        const div = document.createElement('div');
        div.classList.add('message');

        if (msg.sender.toLowerCase() === 'khirsy') {
            div.classList.add('khirsy');
        } else {
            div.classList.add('sedan');
        }

        div.dataset.date = msg.date;

        let content = '';

        if (msg.message) {
            content += `<div class="text">${highlightText(msg.message, searchInput.value)}</div>`;
        } else if (msg.sticker) {
            content += `
                <div class="sticker">
                    <img src="media/${msg.sticker}" alt="Sticker" style="max-width:150px;">
                </div>`;
        }

        content += `<div class="time">${msg.time}</div>`;

        div.innerHTML = content;
        messagesDiv.appendChild(div);

        if (index === 0) {
            stickyDate.textContent = msg.date;
        }
    });
}

function highlightText(text, query) {
    if (!query) return text;
    return text.replace(new RegExp(`(${query})`, 'gi'), '<mark>$1</mark>');
}

async function loadMessages() {
    try {
        const res = await fetch('chat.json');
        messages = await res.json();
        displayMessages(messages);
    } catch (err) {
        console.error('Errore caricamento chat:', err);
    }
}

chatContainer.addEventListener('scroll', () => {
    const msgs = document.querySelectorAll('.message');

    for (let msg of msgs) {
        if (msg.offsetTop >= chatContainer.scrollTop) {
            stickyDate.textContent = msg.dataset.date;
            break;
        }
    }
});

searchBtn.addEventListener('click', () => {
    if (searchInput.style.display === 'block') {
        searchInput.style.display = 'none';
        searchInput.value = '';
        displayMessages(messages);
        searchNav.style.display = 'none';
        searchCounter.textContent = '';
    } else {
        searchInput.style.display = 'block';
        searchInput.focus();
    }
});

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();

    displayMessages(messages);
    searchResults = [];
    currentIndex = 0;

    if (!query) {
        searchNav.style.display = 'none';
        searchCounter.textContent = '';
        return;
    }

    const allMessages = document.querySelectorAll('.message');

    allMessages.forEach(msg => {
        const textDiv = msg.querySelector('.text');
        if (textDiv && textDiv.textContent.toLowerCase().includes(query)) {
            searchResults.push(msg);
        }
    });

    if (searchResults.length > 0) {
        searchNav.style.display = 'flex';
        scrollToResult(0);
    } else {
        searchNav.style.display = 'none';
        searchCounter.textContent = '0 / 0 risultati';
    }
});

function scrollToResult(index) {
    if (!searchResults[index]) return;

    searchResults[index].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    currentIndex = index;

    searchCounter.textContent = `${currentIndex + 1} / ${searchResults.length} risultati`;
}

nextBtn.addEventListener('click', () => {
    if (currentIndex < searchResults.length - 1) {
        scrollToResult(currentIndex + 1);
    }
});

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        scrollToResult(currentIndex - 1);
    }
});

loadMessages();
