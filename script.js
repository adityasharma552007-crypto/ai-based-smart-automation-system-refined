document.addEventListener('DOMContentLoaded', () => {

    // --- Navigation Logic ---
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const viewSections = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked nav item
            item.classList.add('active');

            // Hide all sections
            viewSections.forEach(section => {
                section.classList.remove('active');
                section.classList.add('hidden');
            });

            // Show target section
            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if(targetSection) {
                targetSection.classList.remove('hidden');
                // Small timeout to allow display:block to apply before animating opacity
                setTimeout(() => {
                    targetSection.classList.add('active');
                }, 10);
            }
        });
    });

    // --- Mock Data Generators ---

    // 1. Traffic Data
    const generateTrafficData = () => {
        const citySelect = document.getElementById('city-selector');
        const q = (citySelect && citySelect.value) ? '?city=' + encodeURIComponent(citySelect.value) : '';
        fetch('http://127.0.0.1:5000/api/traffic' + q)
            .then(res => res.json())
            .then(data => {
                const randomStatus = data.congestion_pct || 'Low';
                let densityVal = 30; // default Low
                if(randomStatus === 'Medium') densityVal = 55;
                if(randomStatus === 'High') densityVal = 85;

                let color = 'var(--neon-green)';
                if (randomStatus === 'Medium') color = 'var(--neon-cyan)';
                if (randomStatus === 'High') color = '#EF4444';

                // Update Dashboard Summary
                const dashTrafficDensity = document.getElementById('dash-traffic-density');
                if (dashTrafficDensity) {
                    dashTrafficDensity.textContent = randomStatus;
                    dashTrafficDensity.style.color = color;
                    dashTrafficDensity.nextElementSibling.querySelector('.progress').style.width = `${densityVal}%`;
                    dashTrafficDensity.nextElementSibling.querySelector('.progress').style.background = color;
                    dashTrafficDensity.previousElementSibling.lastElementChild.textContent = `${densityVal}% Capacity`;
                }
            }).catch(e => console.error("Traffic API error:", e));
    };

    // 2. Environment Data
    const generateEnvironmentData = () => {
        const citySelect = document.getElementById('city-selector');
        const q = (citySelect && citySelect.value) ? '?city=' + encodeURIComponent(citySelect.value) : '';
        fetch('http://127.0.0.1:5000/api/weather' + q)
            .then(res => res.json())
            .then(data => {
                const temp = data.temp;
                const aqi = data.aqi;
                const humidity = data.humidity;
                
                let aqiStatus = 'Good';
                let aqiColor = 'var(--neon-green)';
                if (aqi > 50 && aqi <= 100) { aqiStatus = 'Moderate'; aqiColor = '#FBBF24'; }
                else if (aqi > 100) { aqiStatus = 'Poor'; aqiColor = '#EF4444'; }

                const envTemp = document.getElementById('env-temp');
                if(envTemp) envTemp.innerHTML = `${temp}<span>°C</span>`;
                
                const envAqi = document.getElementById('env-aqi');
                if(envAqi) { envAqi.textContent = aqi; envAqi.style.color = aqiColor; }

                const envHumidity = document.getElementById('env-humidity');
                if(envHumidity) {
                    envHumidity.innerHTML = `${humidity}<span>%</span>`;
                    envHumidity.nextElementSibling.querySelector('.progress').style.width = `${humidity}%`;
                }

                // Update Dashboard Summary
                const dashAqiVal = document.getElementById('dash-aqi-val');
                if(dashAqiVal) {
                    dashAqiVal.textContent = aqi;
                    dashAqiVal.nextElementSibling.textContent = aqiStatus.toUpperCase();
                    dashAqiVal.parentElement.style.borderColor = aqiColor;
                    document.getElementById('dash-aqi-text').textContent = `${aqi} (${aqiStatus})`;
                }
            }).catch(e => console.error("Weather API error:", e));
    };

    // 3. Waste Data
    const generateWasteData = () => {
        const citySelect = document.getElementById('city-selector');
        const q = (citySelect && citySelect.value) ? '?city=' + encodeURIComponent(citySelect.value) : '';
        fetch('http://127.0.0.1:5000/api/waste' + q)
            .then(res => res.json())
            .then(data => {
                const capacities = [data.zone_a_pct, data.zone_b_pct, data.zone_c_pct, data.zone_d_pct];
                let fullCount = 0;
                
                document.querySelectorAll('#bin-container .bin-card').forEach((card, i) => {
                    const capacity = capacities[i] || 0;
                    let status = 'EMPTY';
                    let color = 'var(--neon-green)';
                    let statusLabel = 'Optimal';
                    let colorClass = 'green';

                    if(capacity > 40 && capacity <= 80) { status = 'HALF FULL'; color = '#FCD34D'; statusLabel = 'Rising'; colorClass = 'yellow'; }
                    else if(capacity > 80) { status = 'FULL'; color = '#EF4444'; statusLabel = 'Critical'; colorClass = 'red'; fullCount++; card.classList.add('critical-bin'); }
                    else { card.classList.remove('critical-bin'); }

                    const headerBadge = card.querySelector('.badge-sm');
                    const binIcon = card.querySelector('.bin-icon');
                    headerBadge.textContent = status;
                    headerBadge.className = `badge-sm ${colorClass}`;
                    binIcon.className = `bin-icon ${colorClass}`;

                    const progressBar = card.querySelector('.progress');
                    progressBar.style.width = `${capacity}%`;
                    progressBar.style.background = color;

                    const labels = card.querySelectorAll('.flex-between small');
                    if(labels.length === 2) {
                        labels[0].textContent = `${capacity}% Capacity`;
                        labels[1].textContent = statusLabel;
                        if(statusLabel === 'Critical') labels[1].classList.add('text-red');
                        else labels[1].classList.remove('text-red');
                    }
                });

                // Update Dashboard Widget
                const dashWasteAlert = document.getElementById('dash-waste-alert');
                if(dashWasteAlert) {
                    if(fullCount > 0) {
                        dashWasteAlert.style.display = 'block';
                        dashWasteAlert.innerHTML = `<strong>⚠️ Bin Full in Multiple Sectors</strong><br>Immediate action suggested`;
                        dashWasteAlert.className = 'alert-box warning-alert';
                        dashWasteAlert.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        dashWasteAlert.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                        dashWasteAlert.style.color = '#fff';
                    } else {
                        dashWasteAlert.innerHTML = `<strong>✅ All nominal</strong><br>Sectors operating below critical loads`;
                        dashWasteAlert.style.backgroundColor = 'rgba(0, 255, 102, 0.1)';
                        dashWasteAlert.style.borderColor = 'rgba(0, 255, 102, 0.3)';
                    }
                }
            }).catch(e => console.error("Waste API error:", e));
    };

    // Initialize mock data
    generateTrafficData();
    generateEnvironmentData();
    generateWasteData();
    
    // Expose to window for global access
    window.generateTrafficData = generateTrafficData;
    window.generateEnvironmentData = generateEnvironmentData;
    window.generateWasteData = generateWasteData;


    // --- Interactivity / Buttons ---

    const handleButtonClick = (btnId, loadingText, originalText, callback) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            const originalContent = btn.innerHTML;
            btn.innerHTML = `⟳ ${loadingText}...`;
            btn.classList.add('loading');
            
            // Simulate network request
            setTimeout(() => {
                btn.innerHTML = originalContent; // restore
                btn.classList.remove('loading');
                if(callback) callback();

                // Optional: Flash green to indicate success
                const originalBg = btn.style.background;
                btn.style.background = 'var(--neon-green)';
                btn.style.color = '#000';
                setTimeout(() => {
                    btn.style.background = originalBg;
                    btn.style.color = ''; // reset to class styling
                }, 500);

            }, 1200);
        });
    };

    handleButtonClick('btn-predict-traffic', 'Predicting', 'Predict Traffic ↗', generateTrafficData);
    handleButtonClick('btn-refresh-data', 'Refreshing', 'Refresh Data ↻', generateEnvironmentData);
    handleButtonClick('env-refresh-btn', 'Refreshing', '↻ Refresh Data', generateEnvironmentData);
    
    // Waste Pickup scheduling
    const handlePickup = () => {
        setTimeout(()=> {
            alert('Waste pickup truck dispatched successfully.');
            // Reset waste data as if truck picked it up
            document.querySelectorAll('#bin-container .bin-card').forEach(card => {
                 const progressBar = card.querySelector('.progress');
                 progressBar.style.width = '5%';
                 progressBar.style.background = 'var(--neon-green)';
                 const headerBadge = card.querySelector('.badge-sm');
                 headerBadge.textContent = 'EMPTY';
                 headerBadge.className = `badge-sm green`;
                 const binIcon = card.querySelector('.bin-icon');
                 binIcon.className = `bin-icon green`;
                 const labels = card.querySelectorAll('.flex-between small');
                 if(labels.length === 2) {
                     labels[0].textContent = `5% Capacity`;
                     labels[1].textContent = 'Optimal';
                     labels[1].classList.remove('text-red');
                 }
            });
            const dashWasteAlert = document.getElementById('dash-waste-alert');
            if(dashWasteAlert) {
                dashWasteAlert.innerHTML = `<strong>✅ Pickup Complete</strong><br>Bins have been emptied.`;
                dashWasteAlert.style.backgroundColor = 'rgba(0, 255, 102, 0.1)';
                dashWasteAlert.style.borderColor = 'rgba(0, 255, 102, 0.3)';
            }
        }, 300);
    };

    handleButtonClick('btn-schedule-pickup', 'Scheduling', 'Schedule Pickup 🚛', handlePickup);
    handleButtonClick('waste-sch-btn', 'Scheduling', '🚛 Schedule Pickup', handlePickup);

});
