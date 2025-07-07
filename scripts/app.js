// --- Resume Builder App ---

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resume-form');
    const preview = document.getElementById('resume-preview');
    const templateBtns = [
        document.getElementById('template1-btn'),
        document.getElementById('template2-btn'),
        document.getElementById('template3-btn')
    ];
    const exportPDF = document.getElementById('export-pdf');
    const exportDOCX = document.getElementById('export-docx');
    const exportHTML = document.getElementById('export-html');

    // --- Settings Button for API Key ---
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = 'Settings';
    settingsBtn.style.position = 'fixed';
    settingsBtn.style.top = '1rem';
    settingsBtn.style.right = '1rem';
    settingsBtn.style.zIndex = '1000';
    document.body.appendChild(settingsBtn);
    settingsBtn.addEventListener('click', () => {
        promptForApiKey(true);
    });

    // Load saved data
    loadFormData();
    updatePreview();

    // Form input listeners for live preview and localStorage
    form.addEventListener('input', () => {
        saveFormData();
        updatePreview();
    });

    // Form submit handler (calls Gemini AI)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const apiKey = getApiKey();
        if (!apiKey) {
            await promptForApiKey();
            return;
        }
        preview.innerHTML = '<em>Generating resume with AI...</em>';
        try {
            const data = getFormData();
            let aiContent = await generateResumeWithGemini(data, apiKey);
            // Remove code block markers
            aiContent = aiContent.replace(/```html|```/gi, '');
            const templateIdx = localStorage.getItem('selectedTemplate') || '0';
            const templateClass = `template${parseInt(templateIdx, 10) + 1}`;
            // Minimal sanitization: remove <html>, <body>, <head> tags if present
            let cleanHtml = aiContent.replace(/<\/?(html|body|head)[^>]*>/gi, '');
            // Remove common bullet symbols and dashes
            cleanHtml = cleanHtml.replace(/[\n\r]?\s*([*\-•●‣▪‣])\s?/g, ' ');

            // --- Remove repeated section headers and 'Keywords:' lines ---
            cleanHtml = cleanHtml.replace(/<[^>]*>?/gm, match => match.toLowerCase().includes('keywords') ? '' : match);
            cleanHtml = cleanHtml.replace(/Keywords:.*(\n|$)/gi, '');
            const seenHeaders = new Set();
            cleanHtml = cleanHtml.replace(/<h3>([^<]+)<\/h3>/gi, (match, header) => {
                if (seenHeaders.has(header.toLowerCase())) return '';
                seenHeaders.add(header.toLowerCase());
                return match;
            });
            const lines = cleanHtml.split(/<br\s*\/?>|\n|\r/);
            const seenLines = new Set();
            cleanHtml = lines.map(line => {
                const trimmed = line.trim();
                if (!trimmed || seenLines.has(trimmed.toLowerCase())) return '';
                seenLines.add(trimmed.toLowerCase());
                return line;
            }).join('');

            // --- Enhanced Formatting ---
            let fallback = false;
            if (!/<h2|<h3|<ul|<ol/.test(cleanHtml)) fallback = true;

            function stripSymbols(str) {
                return str.replace(/^[*\-•●‣▪‣\s]+/, '').replace(/[*\-•●‣▪‣]+$/, '').trim();
            }
            function dedupeSkills(skills) {
                const arr = skills.split(/,|\n/).map(s => stripSymbols(s)).map(s => s.toLowerCase().trim()).filter(Boolean);
                return Array.from(new Set(arr));
            }

            // Template 1: Clean light two-column layout, show all details
            if (templateClass === 'template1') {
                // Sidebar: name, email, phone, LinkedIn, location, languages, skills
                const name = data.name || 'Your Name';
                const email = data.email || '';
                const phone = data.phone || '';
                const linkedin = data.linkedin || '';
                const location = data.location || '';
                const languages = data.languages || '';
                const skillsArr = dedupeSkills(data.skills || '');
                let sidebarHtml = `<h2>${name}</h2>`;
                sidebarHtml += `<section><span class="label">Contact</span><ul>`;
                if (email) sidebarHtml += `<li>${email}</li>`;
                if (phone) sidebarHtml += `<li>${phone}</li>`;
                if (linkedin) sidebarHtml += `<li>${linkedin}</li>`;
                sidebarHtml += `</ul></section>`;
                if (location) sidebarHtml += `<section><span class="label">Location</span><div>${location}</div></section>`;
                if (languages) sidebarHtml += `<section><span class="label">Languages</span><ul>${languages.split(/,|\n/).map(l => `<li>${l.trim()}</li>`).join('')}</ul></section>`;
                if (skillsArr.length) sidebarHtml += `<section><span class="label">Skills</span><ul>${skillsArr.map(s => `<li>${s}</li>`).join('')}</ul></section>`;

                // Main: summary, experience, education, achievements, jobdesc
                let mainHtml = '';
                if (data.summary) mainHtml += `<h3>Summary</h3><p>${data.summary}</p>`;
                // Experience
                const expMatch = cleanHtml.match(/<h3>Experience<\/h3>[\s\S]*?(<h3|$)/i);
                if (expMatch) {
                    mainHtml += `<h3>Work Experience</h3>${expMatch[0].replace(/<h3>Experience<\/h3>/i, '')}`;
                } else if (data.experience) {
                    // Fallback to user input
                    const expList = data.experience.split(/\n|\r/).map(e => e.trim()).filter(Boolean);
                    if (expList.length) {
                        mainHtml += `<h3>Work Experience</h3><ul>${expList.map(e => `<li>${e}</li>`).join('')}</ul>`;
                    }
                }
                // Education
                const eduMatch = cleanHtml.match(/<h3>Education<\/h3>[\s\S]*?(<h3|$)/i);
                if (eduMatch) {
                    mainHtml += `<h3>Education</h3>${eduMatch[0].replace(/<h3>Education<\/h3>/i, '')}`;
                } else if (data.education) {
                    // Fallback to user input
                    const eduList = data.education.split(/\n|\r/).map(e => e.trim()).filter(Boolean);
                    if (eduList.length) {
                        mainHtml += `<h3>Education</h3><ul>${eduList.map(e => `<li>${e}</li>`).join('')}</ul>`;
                    }
                }
                // Achievements/Projects
                const achMatch = cleanHtml.match(/<h3>(Achievements|Projects|Achievements and Key Projects)<\/h3>[\s\S]*?(<h3|$)/i);
                if (achMatch) mainHtml += `<h3>Achievements</h3>${achMatch[0].replace(/<h3>.*<\/h3>/i, '')}`;
                // Job Description
                if (data.jobdesc) mainHtml += `<h3>Job Description</h3><p>${data.jobdesc}</p>`;

                preview.innerHTML = `<div class="template1"><aside class="template1-sidebar">${sidebarHtml}</aside><section class="template1-main">${mainHtml}</section></div>`;
                return;
            }

            // Template 2: Two-column layout
            if (templateClass === 'template2') {
                // Sidebar: name, contact, location, languages, LinkedIn, skills
                // Main: summary, education, experience, etc.
                const name = data.name || 'Your Name';
                const email = data.email || '';
                const phone = data.phone || '';
                const linkedin = data.linkedin || '';
                const location = data.location || '';
                const languages = data.languages || '';
                const skillsArr = dedupeSkills(data.skills || '');
                let sidebarHtml = `<h2>${name}</h2>`;
                sidebarHtml += `<section><span class="label">Contact</span><ul>`;
                if (email) sidebarHtml += `<li>${email}</li>`;
                if (phone) sidebarHtml += `<li>${phone}</li>`;
                if (linkedin) sidebarHtml += `<li>${linkedin}</li>`;
                sidebarHtml += `</ul></section>`;
                if (location) sidebarHtml += `<section><span class="label">Location</span><div>${location}</div></section>`;
                if (languages) sidebarHtml += `<section><span class="label">Languages</span><div>${languages}</div></section>`;
                if (skillsArr.length) sidebarHtml += `<section><span class="label">Skills</span><ul>${skillsArr.map(s => `<li>${s}</li>`).join('')}</ul></section>`;
                // Main content: use AI output, but remove any repeated skills section
                let mainHtml = cleanHtml.replace(/<h3>Skills<\/h3>[\s\S]*?(<h3|$)/i, '$1');
                preview.innerHTML = `<div class="template2"><aside class="template2-sidebar">${sidebarHtml}</aside><section class="template2-main">${mainHtml}</section></div>`;
                return;
            }

            if (fallback) {
                const skillsList = dedupeSkills(data.skills || '');
                const expList = data.experience.split(/\n|\r/).map(e => stripSymbols(e)).filter(Boolean);
                cleanHtml = `
                    <h2>${data.name || 'Your Name'}</h2>
                    <p><strong>Email:</strong> ${data.email || ''} | <strong>Phone:</strong> ${data.phone || ''} | <strong>LinkedIn:</strong> ${data.linkedin || ''}</p>
                    <h3>Professional Summary</h3>
                    <p>${data.summary || ''}</p>
                    <h3>Experience</h3>
                    <ul>${expList.map(e => `<li>${e}</li>`).join('')}</ul>
                    <h3>Education</h3>
                    <p>${data.education || ''}</p>
                    <h3>Skills</h3>
                    <ul>${skillsList.map(s => `<li>${s}</li>`).join('')}</ul>
                `;
            } else {
                cleanHtml = cleanHtml
                    .replace(/(Summary|Professional Summary)/gi, '<h3>Professional Summary</h3>')
                    .replace(/(Experience)/gi, '<h3>Experience</h3>')
                    .replace(/(Education)/gi, '<h3>Education</h3>')
                    .replace(/(Skills)/gi, '<h3>Skills</h3>');
                cleanHtml = cleanHtml.replace(/Skills:<\/h3>\s*([^<]+)/i, (m, skills) => {
                    const items = dedupeSkills(skills).filter(Boolean);
                    return 'Skills:</h3><ul>' + items.map(s => `<li>${s}</li>`).join('') + '</ul>';
                });
            }
            preview.innerHTML = `<div class="${templateClass}">${cleanHtml}</div>`;
        } catch (err) {
            preview.innerHTML = '<span style="color:red">Error generating resume: ' + err.message + '</span>';
        }
    });

    // Template switching
    templateBtns.forEach((btn, idx) => {
        btn.addEventListener('click', () => {
            templateBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            localStorage.setItem('selectedTemplate', idx);
            updatePreview();
        });
    });
    // Restore selected template
    const savedTemplate = localStorage.getItem('selectedTemplate');
    if (savedTemplate) {
        templateBtns[savedTemplate].classList.add('selected');
    } else {
        templateBtns[0].classList.add('selected');
    }

    // Export buttons (placeholders)
    exportPDF.addEventListener('click', () => {
        alert('PDF export coming soon!');
    });
    exportDOCX.addEventListener('click', () => {
        alert('DOCX export coming soon!');
    });
    exportHTML.addEventListener('click', () => {
        alert('HTML export coming soon!');
    });

    // --- Helper Functions ---
    function updatePreview() {
        const data = getFormData();
        const template = localStorage.getItem('selectedTemplate') || '0';
        // Simple preview for now
        preview.innerHTML = `
            <h2>${data.name || 'Your Name'}</h2>
            <p><strong>Email:</strong> ${data.email || ''} | <strong>Phone:</strong> ${data.phone || ''} | <strong>LinkedIn:</strong> ${data.linkedin || ''}</p>
            <h3>Professional Summary</h3>
            <p>${data.summary || ''}</p>
            <h3>Experience</h3>
            <p>${data.experience || ''}</p>
            <h3>Education</h3>
            <p>${data.education || ''}</p>
            <h3>Skills</h3>
            <p>${data.skills || ''}</p>
        `;
    }
    function getFormData() {
        return {
            name: form.name.value,
            email: form.email.value,
            phone: form.phone.value,
            linkedin: form.linkedin.value,
            summary: form.summary.value,
            experience: form.experience.value,
            education: form.education.value,
            skills: form.skills.value,
            jobdesc: form.jobdesc.value
        };
    }
    function saveFormData() {
        localStorage.setItem('resumeFormData', JSON.stringify(getFormData()));
    }
    function loadFormData() {
        const saved = localStorage.getItem('resumeFormData');
        if (saved) {
            const data = JSON.parse(saved);
            Object.keys(data).forEach(key => {
                if (form[key]) form[key].value = data[key];
            });
        }
    }
    function getApiKey() {
        return localStorage.getItem('geminiApiKey') || '';
    }
    async function promptForApiKey(force = false) {
        let apiKey = getApiKey();
        const defaultKey = 'AIzaSyCWsNaYbmuF_hykTchP1DUXvUGAmWS9-Xo';
        if (!apiKey || force) {
            apiKey = window.prompt('Enter your Gemini API key:', apiKey || defaultKey);
            if (apiKey) {
                localStorage.setItem('geminiApiKey', apiKey);
                alert('API key saved!');
            } else if (force) {
                localStorage.removeItem('geminiApiKey');
                alert('API key cleared. You must enter a key to use AI features.');
            }
        }
        return apiKey;
    }
    async function generateResumeWithGemini(data, apiKey) {
        // Gemini API endpoint (example for Gemini Pro)
        const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
        // Compose prompt
        const prompt = `Generate an ATS-friendly resume based on the following information. Use industry keywords, optimize for ATS, and match the job description. Do not repeat information or include a separate 'Keywords' section.\n\nPersonal Info: ${data.name}, ${data.email}, ${data.phone}, ${data.linkedin}\nSummary: ${data.summary}\nExperience: ${data.experience}\nEducation: ${data.education}\nSkills: ${data.skills}\nJob Description: ${data.jobdesc}\n\nReturn the resume in clean HTML format.`;
        const body = {
            contents: [{ parts: [{ text: prompt }] }]
        };
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            throw new Error('Gemini API error: ' + res.status);
        }
        const result = await res.json();
        // Parse Gemini response (HTML expected)
        const aiHtml = result.candidates?.[0]?.content?.parts?.[0]?.text || '<em>No content generated.</em>';
        return aiHtml;
    }
}); 