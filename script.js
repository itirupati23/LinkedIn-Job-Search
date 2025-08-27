document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs
            tabs.forEach(item => item.classList.remove('active-tab'));
            // Activate clicked tab
            tab.classList.add('active-tab');

            const target = document.getElementById(tab.dataset.tab);

            // Hide all tab contents
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Show target tab content
            if (target) {
                target.classList.remove('hidden');
            }
        });
    });

    // Job Search Form Logic
    const jobSearchForm = document.getElementById('job-search-form');
    if (jobSearchForm) {
        jobSearchForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const keywords = document.getElementById('keywords').value;
            const datePosted = document.getElementById('date-posted').value;
            const location = document.getElementById('location').value;

            if (!keywords.trim()) {
                alert('Please enter a job title or keywords.');
                return;
            }

            // Construct the LinkedIn URL as specified, including the geoId for Worldwide.
            let url = `https://www.linkedin.com/jobs/search-results/?f_TPR=r${datePosted}&geoId=105214831&keywords=${encodeURIComponent(keywords)}&origin=SWITCH_SEARCH_VERTICAL`;

            if (location.trim()) {
                // If a location is provided, append it to the search query.
                // This will override the geoId search on LinkedIn's side.
                url += `&location=${encodeURIComponent(location.trim())}`;
            }

            window.open(url, '_blank');
        });
    }

    // AI Resume Analyzer Logic
    const HUGGING_FACE_API_KEY = 'YOUR_HUGGING_FACE_API_KEY_HERE'; // IMPORTANT: Replace with your Hugging Face API key
    const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

    async function analyzeWithAI(resumeText, targetRole) {
        if (HUGGING_FACE_API_KEY === 'YOUR_HUGGING_FACE_API_KEY_HERE' || !HUGGING_FACE_API_KEY) {
            throw new Error('API key not configured. Please add your Hugging Face API key in script.js');
        }

        const prompt = `[INST] You are an expert career coach. Your task is to analyze a resume for a candidate targeting a '${targetRole}' position. Provide a detailed analysis covering the candidate's strengths, potential skill gaps, and actionable suggestions for improvement. Structure your response in Markdown format with clear headings.

Resume Text:
---
${resumeText}
---
[/INST]
`;

        const response = await fetch(HUGGING_FACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: 1024,
                    temperature: 0.7,
                    top_p: 0.95,
                    return_full_text: false,
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            // The API can sometimes send a 503 if the model is loading.
            if(response.status === 503) {
                 throw new Error('The AI model is currently loading, please try again in a moment.');
            }
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (result && result[0] && result[0].generated_text) {
            return result[0].generated_text;
        } else {
            throw new Error('Unexpected response format from the AI. Check the model and API documentation.');
        }
    }

    const analyzeResumeBtn = document.getElementById('analyze-resume-btn');
    const resumeFileInput = document.getElementById('resume-file');
    const resumeResults = document.getElementById('resume-results');
    const resumeSpinner = document.getElementById('resume-spinner');
    const resumeOutput = document.getElementById('resume-output');
    const targetRoleInput = document.getElementById('target-role');

    if (analyzeResumeBtn) {
        analyzeResumeBtn.addEventListener('click', async () => {
            const file = resumeFileInput.files[0];
            const targetRole = targetRoleInput.value;

            if (!file) {
                alert('Please upload a resume file.');
                return;
            }
            if (!targetRole.trim()) {
                alert('Please enter a target job role.');
                return;
            }

            resumeResults.classList.remove('hidden');
            resumeSpinner.style.display = 'flex';
            resumeOutput.innerHTML = '';
            resumeOutput.classList.add('hidden');


            try {
                let text = '';
                const fileName = file.name;
                const fileExtension = fileName.split('.').pop().toLowerCase();

                if (fileExtension === 'txt') {
                    text = await file.text();
                } else if (fileExtension === 'docx') {
                    const arrayBuffer = await file.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    text = result.value;
                } else if (fileExtension === 'pdf') {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
                    const numPages = pdf.numPages;
                    let pdfText = '';
                    for(let i = 1; i <= numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        pdfText += textContent.items.map(item => item.str).join(' ');
                    }
                    text = pdfText;
                } else {
                    alert('Unsupported file type. Please upload a .txt, .docx, or .pdf file.');
                    resumeResults.classList.add('hidden');
                    return;
                }

                console.log("Extracted Text Length:", text.length);

                const aiAnalysis = await analyzeWithAI(text, targetRole);
                const converter = new showdown.Converter({
                    simplifiedAutoLink: true,
                    strikethrough: true,
                    tables: true
                });
                const htmlOutput = converter.makeHtml(aiAnalysis);

                resumeSpinner.style.display = 'none';
                resumeOutput.classList.remove('hidden');
                resumeOutput.innerHTML = htmlOutput;

            } catch (error) {
                console.error('AI Analysis Error:', error);
                alert(`An error occurred during analysis: ${error.message}`);
                resumeSpinner.style.display = 'none';
                resumeResults.classList.add('hidden');
            }
        });
    }

    // Market Insights Logic
    let skillsChartInstance = null; // To hold the chart instance and prevent duplicates

    function processJobData(jobData) {
        const insights = {
            totalJobs: jobData.length,
            salaries: [],
            companies: {},
            skills: {}
        };

        jobData.forEach(job => {
            // Process salary (only if salary data is present and seems valid)
            if (job.job_min_salary && job.job_max_salary && job.job_salary_period === 'YEAR') {
                insights.salaries.push((job.job_min_salary + job.job_max_salary) / 2);
            }

            // Process companies
            if (job.employer_name) {
                insights.companies[job.employer_name] = (insights.companies[job.employer_name] || 0) + 1;
            }

            // Process skills from job_highlights qualifications
            if (job.job_highlights && Array.isArray(job.job_highlights.Qualifications)) {
                job.job_highlights.Qualifications.forEach(skill => {
                    // Basic filtering to get more relevant skills
                    if (skill.length > 1 && skill.length < 25 && !skill.toLowerCase().includes('degree')) {
                        const cleanedSkill = skill.toLowerCase().trim().replace(/['".,]/g, '');
                        insights.skills[cleanedSkill] = (insights.skills[cleanedSkill] || 0) + 1;
                    }
                });
            }
        });

        const avgSalary = insights.salaries.length > 0
            ? insights.salaries.reduce((a, b) => a + b, 0) / insights.salaries.length
            : 0;

        const topCompanies = Object.entries(insights.companies)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name]) => name);

        const topSkills = Object.entries(insights.skills)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10);

        return {
            totalJobs: insights.totalJobs,
            avgSalary: Math.round(avgSalary),
            topCompanies,
            topSkills
        };
    }

    function displayInsights(insights) {
        const summaryContainer = document.getElementById('insights-summary');
        const skillsContainer = document.getElementById('skills-chart-container');
        summaryContainer.innerHTML = ''; // Clear previous results

        if (insights.totalJobs === 0) {
            skillsContainer.classList.add('hidden');
            return;
        }
        skillsContainer.classList.remove('hidden');

        summaryContainer.innerHTML = `
            <div class="bg-blue-100 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm font-semibold text-blue-800">Postings Analyzed</h4>
                <p class="text-3xl font-bold text-blue-900">${insights.totalJobs}</p>
            </div>
            <div class="bg-green-100 p-4 rounded-lg shadow text-center">
                <h4 class="text-sm font-semibold text-green-800">Estimated Avg. Salary (Yearly)</h4>
                <p class="text-3xl font-bold text-green-900">${insights.avgSalary > 0 ? `$${insights.avgSalary.toLocaleString()}` : 'N/A'}</p>
            </div>
            <div class="bg-purple-100 p-4 rounded-lg shadow">
                <h4 class="text-sm font-semibold text-purple-800 text-center">Top Hiring Companies</h4>
                <ul class="text-sm text-purple-900 mt-2 space-y-1">${insights.topCompanies.map(c => `<li class="truncate">${c}</li>`).join('') || 'N/A'}</ul>
            </div>
        `;

        const ctx = document.getElementById('skills-chart').getContext('2d');
        if (skillsChartInstance) {
            skillsChartInstance.destroy();
        }

        skillsChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: insights.topSkills.map(([skill]) => skill.charAt(0).toUpperCase() + skill.slice(1)),
                datasets: [{
                    label: 'Frequency in Job Postings',
                    data: insights.topSkills.map(([, count]) => count),
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Frequency: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } },
                    y: { grid: { display: false } }
                }
            }
        });
    }

    const JSEARCH_API_KEY = 'YOUR_JSEARCH_API_KEY_HERE'; // IMPORTANT: Replace with your RapidAPI JSearch key
    const JSEARCH_API_HOST = 'jsearch.p.rapidapi.com';

    async function getMarketInsights(jobRole) {
        if (JSEARCH_API_KEY === 'YOUR_JSEARCH_API_KEY_HERE' || !JSEARCH_API_KEY) {
            throw new Error('API key not configured. Please add your JSearch API key in script.js');
        }

        const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(jobRole)}&num_pages=1&page=1`;
        const options = {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': JSEARCH_API_KEY,
                'X-RapidAPI-Host': JSEARCH_API_HOST
            }
        };

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`JSearch API request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        if (result && result.data) {
            return result.data;
        } else {
            // JSearch API might return a different structure on failure or empty search
            if(result && result.status === 'OK' && result.data === null) return [];
            throw new Error('Unexpected response format from JSearch API.');
        }
    }

    const getInsightsBtn = document.getElementById('get-insights-btn');
    const insightsJobRoleInput = document.getElementById('insights-job-role');
    const insightsResults = document.getElementById('insights-results');
    const insightsSpinner = document.getElementById('insights-spinner');
    const insightsOutput = document.getElementById('insights-output');

    if (getInsightsBtn) {
        getInsightsBtn.addEventListener('click', async () => {
            const jobRole = insightsJobRoleInput.value;
            if (!jobRole.trim()) {
                alert('Please enter a job role.');
                return;
            }

            insightsResults.classList.remove('hidden');
            insightsSpinner.style.display = 'flex';
            insightsOutput.innerHTML = '';

            try {
                const jobData = await getMarketInsights(jobRole);
                insightsSpinner.style.display = 'none';

                if (jobData.length === 0) {
                    insightsOutput.innerHTML = `<p class="text-center text-gray-500">No job data found for this role. Try a different title.</p>`;
                    // Clear previous results if any
                    document.getElementById('insights-summary').innerHTML = '';
                    document.getElementById('skills-chart-container').classList.add('hidden');
                    if(skillsChartInstance) {
                        skillsChartInstance.destroy();
                        skillsChartInstance = null;
                    }
                } else {
                    const insights = processJobData(jobData);
                    displayInsights(insights);
                }

            } catch (error) {
                console.error('Market Insights Error:', error);
                alert(`Could not fetch market insights: ${error.message}`);
                insightsSpinner.style.display = 'none';
                insightsResults.classList.add('hidden');
            }
        });
    }
});
