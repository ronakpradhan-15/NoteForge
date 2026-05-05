document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    const inputTabs = document.querySelectorAll('.input-tab');
    const textContent = document.getElementById('textContent');
    const fileContent = document.getElementById('fileContent');
    const sourceText = document.getElementById('sourceText');
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    
    const generateBtn = document.getElementById('generateBtn');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');
    const inputSection = document.getElementById('inputSection');
    
    const resultTabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Results Elements
    const summaryContent = document.getElementById('summaryContent');
    const keyPointsList = document.getElementById('keyPointsList');
    const qaAccordion = document.getElementById('qaAccordion');
    
    // Flashcard Elements
    const flashcard = document.getElementById('activeFlashcard');
    const flashcardQuestion = document.getElementById('flashcardQuestion');
    const flashcardAnswer = document.getElementById('flashcardAnswer');
    const flashcardCounter = document.getElementById('flashcardCounter');
    const prevCardBtn = document.getElementById('prevCardBtn');
    const nextCardBtn = document.getElementById('nextCardBtn');
    
    // Copy Buttons
    const copyBtns = document.querySelectorAll('.copy-btn');
    
    // === State ===
    let currentFlashcards = [];
    let currentFlashcardIndex = 0;
    let generatedData = null;

    // === Theme Management ===
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.replace('dark-theme', 'light-theme');
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    } else {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        if (isDark) {
            document.body.classList.replace('dark-theme', 'light-theme');
            localStorage.setItem('theme', 'light');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            document.body.classList.replace('light-theme', 'dark-theme');
            localStorage.setItem('theme', 'dark');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    });

    // === Input Tabs ===
    inputTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            inputTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.type === 'text') {
                textContent.classList.remove('hidden');
                fileContent.classList.add('hidden');
            } else {
                textContent.classList.add('hidden');
                fileContent.classList.remove('hidden');
            }
        });
    });

    // === Summary Length Control ===
    const lengthSegments = document.querySelectorAll('.segment');
    let selectedLength = 'Short'; // Default active in HTML is Short
    
    lengthSegments.forEach(segment => {
        if (segment.classList.contains('active')) {
            selectedLength = segment.textContent.trim();
        }
        segment.addEventListener('click', () => {
            lengthSegments.forEach(s => s.classList.remove('active'));
            segment.classList.add('active');
            selectedLength = segment.textContent.trim();
            
            // If data is already generated, instantly swap the summary text
            if (generatedData) {
                updateSummaryText();
            }
        });
    });
    
    function updateSummaryText() {
        if (!generatedData) return;
        if (selectedLength === 'Short') {
            summaryContent.innerHTML = generatedData.summary_short;
        } else if (selectedLength === 'Medium') {
            summaryContent.innerHTML = generatedData.summary_medium;
        } else if (selectedLength === 'Detailed') {
            summaryContent.innerHTML = generatedData.summary_detailed;
        }
    }

    // === File Drag & Drop ===
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = 'var(--primary-color)';
            dropZone.style.backgroundColor = 'var(--primary-light)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.backgroundColor = 'transparent';
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            dropZone.querySelector('p').innerHTML = `<strong>${file.name}</strong> selected.<br><span class="browse-link" onclick="document.getElementById('fileInput').click()">Change file</span>`;
        }
    }

    // === Generation API ===
    generateBtn.addEventListener('click', async () => {
        // Validate input
        const activeTab = document.querySelector('.input-tab.active').dataset.type;
        const textToProcess = sourceText.value.trim();
        
        if (activeTab === 'text' && !textToProcess) {
            alert('Please paste some text to generate insights.');
            return;
        }
        if (activeTab === 'file' && (!fileInput.files || fileInput.files.length === 0)) {
            alert('Please select a PDF or TXT file to upload.');
            return;
        }

        // Show loading
        generateBtn.disabled = true;
        generateBtn.innerHTML = 'Generating...';
        loadingSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');

        try {
            let fetchOptions = {
                method: 'POST'
            };

            if (activeTab === 'text') {
                fetchOptions.headers = { 'Content-Type': 'application/json' };
                fetchOptions.body = JSON.stringify({ text: textToProcess });
            } else {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                fetchOptions.body = formData;
            }

            const response = await fetch('/api/generate', fetchOptions);

            if (!response.ok) {
                let errorMessage = 'Failed to fetch from backend';
                try {
                    const errData = await response.json();
                    errorMessage = errData.error || errorMessage;
                } catch (e) {
                    if (response.status === 404) {
                        errorMessage = "The backend API was not found. Please ensure your backend server is running and the URL is correct.";
                    } else {
                        errorMessage = `Server error (${response.status}). Please check your backend logs.`;
                    }
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            populateResults(data);
            
            // Hide loading, show results
            loadingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (error) {
            alert('Error generating insights: ' + error.message);
            console.error(error);
            loadingSection.classList.add('hidden');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<span class="btn-text">Generate Insights</span><svg class="sparkle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>';
        }
    });

    // === Results Tabs ===
    resultTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            resultTabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // === Populate Data ===
    function populateResults(data) {
        generatedData = data;
        
        // Summary
        updateSummaryText();
        
        // Key Points
        keyPointsList.innerHTML = data.key_points.map(pt => `<li>${pt}</li>`).join('');
        
        // Flashcards
        currentFlashcards = data.flashcards;
        currentFlashcardIndex = 0;
        updateFlashcardView();
        
        // Q&A
        qaAccordion.innerHTML = data.qa.map((item, index) => `
            <div class="accordion-item">
                <button class="accordion-header">
                    ${item.question}
                    <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="accordion-content">
                    <p><strong class="qa-answer-label">Answer:</strong> ${item.answer}</p>
                </div>
            </div>
        `).join('');

        // Re-bind accordion events
        bindAccordionEvents();
    }

    // === Flashcard Logic ===
    flashcard.addEventListener('click', () => {
        flashcard.classList.toggle('flipped');
    });

    prevCardBtn.addEventListener('click', () => {
        if (currentFlashcardIndex > 0) {
            flashcard.classList.remove('flipped');
            setTimeout(() => {
                currentFlashcardIndex--;
                updateFlashcardView();
            }, 150);
        }
    });

    nextCardBtn.addEventListener('click', async () => {
        if (currentFlashcardIndex < currentFlashcards.length - 1) {
            flashcard.classList.remove('flipped');
            setTimeout(() => {
                currentFlashcardIndex++;
                updateFlashcardView();
            }, 150);
        } else {
            // Generate more flashcards
            nextCardBtn.disabled = true;
            const originalHTML = nextCardBtn.innerHTML;
            nextCardBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0;"></div>';
            
            try {
                // If text was from file upload, we need the stored original_text. If text, we can use the sourceText or original_text.
                const originalText = generatedData._original_text || document.getElementById('sourceText').value.trim();
                
                const response = await fetch('/api/generate_more', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: originalText,
                        existing_items: currentFlashcards
                    })
                });
                
                if (!response.ok) {
                    let errorMessage = 'Failed to load more';
                    try {
                        const errData = await response.json();
                        errorMessage = errData.error || errorMessage;
                    } catch (e) {}
                    throw new Error(errorMessage);
                }
                const newData = await response.json();
                
                if (newData.flashcards && newData.flashcards.length > 0) {
                    currentFlashcards = currentFlashcards.concat(newData.flashcards);
                    flashcard.classList.remove('flipped');
                    setTimeout(() => {
                        currentFlashcardIndex++;
                        updateFlashcardView();
                    }, 150);
                } else {
                    alert('No more flashcards could be generated.');
                }
            } catch (error) {
                console.error(error);
                alert('Error generating more flashcards: ' + error.message);
            } finally {
                nextCardBtn.innerHTML = originalHTML;
                nextCardBtn.disabled = false;
            }
        }
    });

    function updateFlashcardView() {
        if (!currentFlashcards.length) return;
        
        const card = currentFlashcards[currentFlashcardIndex];
        flashcardQuestion.textContent = card.question;
        flashcardAnswer.textContent = card.answer;
        
        flashcardCounter.textContent = `Card ${currentFlashcardIndex + 1}`;
        
        prevCardBtn.disabled = currentFlashcardIndex === 0;
        // nextCardBtn is never disabled because we can always generate more!
        nextCardBtn.disabled = false;
    }

    // === Accordion Logic ===
    function bindAccordionEvents() {
        const headers = document.querySelectorAll('.accordion-header:not([data-bound="true"])');
        headers.forEach(header => {
            header.dataset.bound = "true";
            header.addEventListener('click', async () => {
                const item = header.parentElement;
                const isOpen = item.classList.contains('open');
                
                // Close all others
                document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
                
                if (!isOpen) {
                    item.classList.add('open');
                    
                    // Generate 2 more if not already generated from this item
                    if (!item.dataset.generated) {
                        item.dataset.generated = "true";
                        
                        // Stop generating if we've reached 15 total Q&A pairs
                        if (generatedData.qa && generatedData.qa.length >= 15) {
                            return;
                        }
                        
                        const qaAccordion = document.getElementById('qaAccordion');
                        const spinnerId = 'qa-spinner-' + Date.now();
                        qaAccordion.insertAdjacentHTML('beforeend', `<div id="${spinnerId}" style="text-align:center; padding:10px;"><div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div></div>`);
                        
                        try {
                            const originalText = generatedData._original_text || document.getElementById('sourceText').value.trim();
                            const response = await fetch('/api/generate_more', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    text: originalText,
                                    type: 'qa',
                                    amount: 2,
                                    existing_items: generatedData.qa
                                })
                            });
                            
                            if (response.ok) {
                                const newData = await response.json();
                                if (newData.qa && newData.qa.length > 0) {
                                    generatedData.qa = generatedData.qa.concat(newData.qa);
                                    
                                    const newItemsHTML = newData.qa.map(q => `
                                        <div class="accordion-item">
                                            <button class="accordion-header">
                                                ${q.question}
                                                <svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </button>
                                            <div class="accordion-content">
                                                <p><strong class="qa-answer-label">Answer:</strong> ${q.answer}</p>
                                            </div>
                                        </div>
                                    `).join('');
                                    
                                    qaAccordion.insertAdjacentHTML('beforeend', newItemsHTML);
                                    bindAccordionEvents(); // Bind new items
                                } else {
                                    console.warn("API returned empty Q&A array");
                                }
                            } else {
                                let errorMessage = 'Failed to generate more Q&A';
                                try {
                                    const errData = await response.json();
                                    errorMessage = errData.error || errorMessage;
                                } catch (e) {}
                                console.error("API Error: ", response.status, errorMessage);
                            }
                        } catch (e) {
                            console.error("Fetch failed: ", e);
                        } finally {
                            const spinnerEl = document.getElementById(spinnerId);
                            if(spinnerEl) spinnerEl.remove();
                        }
                    }
                }
            });
        });
    }

    // === Copy Functionality ===
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const contentEl = document.getElementById(targetId);
            
            let textToCopy = '';
            
            if (targetId === 'summaryContent') {
                textToCopy = Array.from(contentEl.querySelectorAll('p')).map(p => p.textContent).join('\n\n');
            } else if (targetId === 'keyPointsContent') {
                textToCopy = Array.from(contentEl.querySelectorAll('li')).map(li => `• ${li.textContent}`).join('\n');
            } else if (targetId === 'qaContent') {
                textToCopy = generatedData.qa.map(q => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n');
            }

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 2000);
            });
        });
    });


    // === Parallax Glow Shadows Logic ===
    const glows = document.querySelectorAll('.bg-glow');
    if (glows.length > 0) {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            
            // Move glow 1 down slightly
            glows[0].style.transform = `translateY(${scrolled * 0.3}px)`;
            
            // Move glow 2 up slightly
            if(glows[1]) glows[1].style.transform = `translateY(${scrolled * -0.2}px)`;
            
            // Move glow 3 down very slowly
            if(glows[2]) glows[2].style.transform = `translateY(${scrolled * 0.1}px)`;
        });
    }

});
