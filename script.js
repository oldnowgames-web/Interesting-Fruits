document.addEventListener('DOMContentLoaded', () => {
    const GRID_SIZE = 6;
    const FRUITS = ['🍎', '🍊', '🍋', '🍐', '🍇', '🍓'];

    // Fruit Juice Colors
    const FRUIT_COLORS = {
        '🍎': '#ef4444',
        '🍊': '#f97316',
        '🍋': '#eab308',
        '🍐': '#22c55e',
        '🍇': '#a855f7',
        '🍓': '#ec4899',
        '⚡': '#38bdf8', // Special Line Laser
        '🌈': '#f43f5e'  // Special Rainbow Bomb
    };

    let board = [];
    let specialBoard = []; // Keeps track of 'laser' or 'rainbow'
    let score = 0;
    let currentLevel = 1;
    let currentXP = 0;
    let targetXP = 180; // Gentle starting XP requirement
    
    // Dynamic Time System
    let currentTime = 100;
    let timeTimer = null;
    let isPaused = false;
    let isGameOver = false;

    let soundEnabled = true;
    let isProcessing = false;

    // Drag / Touch Tracking
    let dragStartCoord = null;
    const SWIPE_THRESHOLD = 18;

    // Audio Context
    let audioCtx = null;

    // Música de fundo
    const bgMusic = new Audio('sounds/interessante.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.35;

    function playMusic() {
        if (!soundEnabled) return;
        bgMusic.play().catch(e => console.log('Music play blocked:', e));
    }

    function stopMusic() {
        bgMusic.pause();
    }

    // Pausa a música quando a aba fica em segundo plano
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            bgMusic.pause();
        } else if (soundEnabled && !isGameOver && document.getElementById('game-screen').style.display === 'flex') {
            playMusic();
        }
    });

    // Particle Canvas Setup
    const canvas = document.getElementById('fx-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let cursorTrail = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Ambient Dust & Swipe Trail Canvas Animation Loop
    function animateFXCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Swipe/Touch Glowing Trail
        if (cursorTrail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(cursorTrail[0].x, cursorTrail[0].y);
            for (let i = 1; i < cursorTrail.length; i++) {
                ctx.lineTo(cursorTrail[i].x, cursorTrail[i].y);
            }
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#ff8533';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Decay cursor trail
        for (let i = cursorTrail.length - 1; i >= 0; i--) {
            cursorTrail[i].life -= 0.08;
            if (cursorTrail[i].life <= 0) {
                cursorTrail.splice(i, 1);
            }
        }

        // 2. Draw Floating Sparkle Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;

            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        requestAnimationFrame(animateFXCanvas);
    }
    animateFXCanvas();

    function spawnAmbientSparkles(x, y, color = '#ffffff', count = 8) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color,
                life: 1,
                decay: Math.random() * 0.03 + 0.02
            });
        }
    }

    // Web Audio API Synthesis
    function initAudio() {
        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) {
                    audioCtx = new AudioContext();
                }
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        } catch (e) {
            console.log('Audio init warning:', e);
        }
    }

    function playSound(type, comboIndex = 1) {
        if (!soundEnabled) return;
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;

            const now = audioCtx.currentTime;

            if (type === 'drag') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'pop' || type === 'slice') {
                const baseFreq = 380 + Math.min(comboIndex * 50, 350);
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(baseFreq, now);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 0.025);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.35, now + 0.09);

                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.095);
            } else if (type === 'special') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, now);
                osc.frequency.exponentialRampToValueAtTime(900, now + 0.2);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.22);
            } else if (type === 'explosion') {
                // Estouro de ruído (explosão)
                const dur = 0.45;
                const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
                }
                const noise = audioCtx.createBufferSource();
                noise.buffer = buffer;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(2500, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + dur);
                const nGain = audioCtx.createGain();
                nGain.gain.setValueAtTime(0.5, now);
                nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
                noise.connect(filter);
                filter.connect(nGain);
                nGain.connect(audioCtx.destination);
                noise.start(now);

                // Pancada grave
                const boom = audioCtx.createOscillator();
                const bGain = audioCtx.createGain();
                boom.type = 'sine';
                boom.frequency.setValueAtTime(140, now);
                boom.frequency.exponentialRampToValueAtTime(35, now + 0.35);
                bGain.gain.setValueAtTime(0.6, now);
                bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                boom.connect(bGain);
                bGain.connect(audioCtx.destination);
                boom.start(now);
                boom.stop(now + 0.4);
            } else if (type === 'levelup') {
                const notes = [440, 554.37, 659.25, 880];
                notes.forEach((freq, idx) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, now + idx * 0.08);
                    g.gain.setValueAtTime(0.25, now + idx * 0.08);
                    g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
                    o.start(now + idx * 0.08);
                    o.stop(now + idx * 0.08 + 0.25);
                });
            } else if (type === 'gameover') {
                const notes = [400, 320, 240, 160];
                notes.forEach((freq, idx) => {
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.frequency.setValueAtTime(freq, now + idx * 0.12);
                    g.gain.setValueAtTime(0.2, now + idx * 0.12);
                    g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.22);
                    o.start(now + idx * 0.12);
                    o.stop(now + idx * 0.12 + 0.22);
                });
            }
        } catch (e) {
            console.log('Audio error:', e);
        }
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        const thumb = document.getElementById('sound-toggle-thumb');
        const btn = document.getElementById('sound-toggle-btn');
        if (soundEnabled) {
            thumb.classList.remove('translate-x-0');
            thumb.classList.add('translate-x-6');
            btn.classList.remove('bg-gray-500');
            btn.classList.add('bg-emerald-500');
            if (document.getElementById('game-screen').style.display === 'flex' && !isGameOver) playMusic();
        } else {
            stopMusic();
            thumb.classList.remove('translate-x-6');
            thumb.classList.add('translate-x-0');
            btn.classList.remove('bg-emerald-500');
            btn.classList.add('bg-gray-500');
        }
    }

    // Stats Persistence
    function getGameStats() {
        try {
            let scores = localStorage.getItem('interesting_fruits_scores');
            let level = localStorage.getItem('interesting_fruits_max_level');
            return {
                scores: scores ? JSON.parse(scores) : [2500, 1800, 1200],
                maxLevel: level ? parseInt(level) : 1
            };
        } catch (e) {
            return { scores: [2500, 1800, 1200], maxLevel: 1 };
        }
    }

    function updateBestScoreDisplay() {
        const stats = getGameStats();
        const best = stats.scores.length > 0 ? Math.max(...stats.scores) : 0;
        document.getElementById('best-score-display').textContent = best;
        document.getElementById('best-level-display').textContent = stats.maxLevel;
    }

    function saveGameStats(newScore, levelReached) {
        try {
            let stats = getGameStats();
            stats.scores.push(newScore);
            stats.scores.sort((a, b) => b - a);
            stats.scores = stats.scores.slice(0, 5);
            if (levelReached > stats.maxLevel) {
                stats.maxLevel = levelReached;
            }
            localStorage.setItem('interesting_fruits_scores', JSON.stringify(stats.scores));
            localStorage.setItem('interesting_fruits_max_level', stats.maxLevel.toString());
            updateBestScoreDisplay();
        } catch (e) {
            console.log('Stats save error:', e);
        }
    }

    function renderHighScores() {
        let stats = getGameStats();
        let listEl = document.getElementById('high-scores-list');
        listEl.innerHTML = '';
        stats.scores.forEach((s, idx) => {
            let item = document.createElement('div');
            item.className = 'flex justify-between items-center py-2 px-3 bg-white/50 rounded-xl font-bold border border-orange-200/60';
            item.innerHTML = `<span class="text-orange-900">#${idx + 1} Recorde</span><span class="text-orange-950 font-black">${s}</span>`;
            listEl.appendChild(item);
        });
    }

    // Modal Handlers
    function openModal(id) {
        if (id === 'pause-modal') isPaused = true;
        document.getElementById(id).style.display = 'flex';
        if (id === 'high-scores-modal') renderHighScores();
    }

    function closeModal(id) {
        if (id === 'pause-modal') isPaused = false;
        document.getElementById(id).style.display = 'none';
    }

    function startGame() {
        initAudio();
        playMusic();
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'flex';
        initGame();
    }

    function returnToMenu() {
        stopTimeTimer();
        closeModal('pause-modal');
        closeModal('game-over-modal');
        document.getElementById('game-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        updateBestScoreDisplay();
    }

    function restartGame() {
        closeModal('pause-modal');
        closeModal('game-over-modal');
        initGame();
        bgMusic.currentTime = 0;
        playMusic();
    }

    // Core Game Setup
    function initGame() {
        score = 0;
        currentLevel = 1;
        currentXP = 0;
        targetXP = 180; // Gentle start
        currentTime = 100;
        isPaused = false;
        isGameOver = false;
        isProcessing = false;

        updateHUD();
        startTimeTimer();

        do {
            board = [];
            specialBoard = [];
            for (let r = 0; r < GRID_SIZE; r++) {
                let row = [];
                let sRow = [];
                for (let c = 0; c < GRID_SIZE; c++) {
                    row.push(getRandomFruit());
                    sRow.push(null);
                }
                board.push(row);
                specialBoard.push(sRow);
            }
        } while (checkMatches().length > 0 || !hasPossibleMoves());

        renderBoard();
    }

    // Time Decay Loop
    function startTimeTimer() {
        stopTimeTimer();
        timeTimer = setInterval(() => {
            if (isPaused || isGameOver) return;

            // Relaxed start: Level 1 drains ~0.12% per 100ms
            let drainAmount = 0.12 + ((currentLevel - 1) * 0.045);
            currentTime = Math.max(0, currentTime - drainAmount);
            
            updateHUD();

            if (currentTime <= 0) {
                stopTimeTimer();
                triggerGameOver();
            }
        }, 100);
    }

    function stopTimeTimer() {
        if (timeTimer) {
            clearInterval(timeTimer);
            timeTimer = null;
        }
    }

    function getRandomFruit() {
        return FRUITS[Math.floor(Math.random() * FRUITS.length)];
    }

    function updateHUD() {
        document.getElementById('score-display').textContent = score;
        document.getElementById('level-display').textContent = currentLevel;
        document.getElementById('xp-text').textContent = `XP: ${Math.floor(currentXP)} / ${targetXP}`;
        
        // XP Progress
        const xpPercent = Math.min(100, Math.floor((currentXP / targetXP) * 100));
        document.getElementById('xp-bar').style.width = `${xpPercent}%`;
        document.getElementById('xp-percent-text').textContent = `${xpPercent}%`;

        // Time Bar
        const percent = Math.floor(currentTime);
        const bar = document.getElementById('time-bar');
        const percentText = document.getElementById('time-percent-text');
        
        bar.style.width = `${percent}%`;
        percentText.textContent = `${percent}%`;

        if (percent < 25) {
            bar.classList.add('time-danger');
        } else {
            bar.classList.remove('time-danger');
        }
    }

    function addXPAndRestoreTime(points) {
        let timeBonus = points * 0.28;
        currentTime = Math.min(100, currentTime + timeBonus);

        currentXP += points;
        if (currentXP >= targetXP) {
            levelUp();
        }

        updateHUD();
    }

    function levelUp() {
        currentLevel++;
        currentXP = Math.max(0, currentXP - targetXP);
        targetXP = Math.floor(targetXP * 1.25 + 40); // Smooth scaling
        currentTime = 100; // Refill

        playSound('levelup');
        triggerScreenShake(true);

        // Confetti Explosion
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        // Overlay
        const overlay = document.getElementById('level-up-overlay');
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 1300);

        showFeedback(`SUBIU DE NÍVEL! NÍVEL ${currentLevel} 🚀`);
    }

    function renderBoard() {
        const gridEl = document.getElementById('fruit-grid');
        gridEl.innerHTML = '';

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'fruit-cell flex items-center justify-center bg-white/80 hover:bg-white rounded-2xl relative aspect-square shadow-sm overflow-hidden cursor-pointer border border-orange-100 transition-all';
                cell.dataset.row = r;
                cell.dataset.col = c;

                const fruitChar = board[r][c];
                const specialType = specialBoard[r][c];

                if (fruitChar) {
                    const fruitEl = document.createElement('div');
                    fruitEl.className = 'fruit-icon text-3xl sm:text-4xl pointer-events-none transition-transform duration-200 transform';
                    
                    if (specialType === 'rainbow') {
                        fruitEl.textContent = '🌈';
                        fruitEl.classList.add('special-rainbow');
                    } else if (specialType === 'laser') {
                        fruitEl.textContent = '⚡';
                        fruitEl.classList.add('special-laser');
                    } else {
                        fruitEl.textContent = fruitChar;
                    }

                    cell.appendChild(fruitEl);
                }

                gridEl.appendChild(cell);
            }
        }
    }

    // Drag / Touch Event Handlers
    const gridEl = document.getElementById('fruit-grid');

    function handleStart(x, y, target) {
        if (isProcessing || isPaused || isGameOver) return;
        const cell = target.closest('.fruit-cell');
        if (!cell) return;

        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);

        dragStartCoord = { row: r, col: c, x, y };
        playSound('drag');
        cursorTrail.push({ x, y, life: 1 });
    }

    function handleMove(x, y) {
        if (!dragStartCoord || isProcessing || isPaused || isGameOver) return;

        cursorTrail.push({ x, y, life: 1 });

        const dx = x - dragStartCoord.x;
        const dy = y - dragStartCoord.y;

        if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
            let targetRow = dragStartCoord.row;
            let targetCol = dragStartCoord.col;

            if (Math.abs(dx) > Math.abs(dy)) {
                targetCol += dx > 0 ? 1 : -1;
            } else {
                targetRow += dy > 0 ? 1 : -1;
            }

            const startR = dragStartCoord.row;
            const startC = dragStartCoord.col;
            dragStartCoord = null;

            if (targetRow >= 0 && targetRow < GRID_SIZE && targetCol >= 0 && targetCol < GRID_SIZE) {
                executeSwap(startR, startC, targetRow, targetCol);
            }
        }
    }

    function handleEnd() {
        dragStartCoord = null;
    }

    gridEl.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, e.target);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!dragStartCoord) return;
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
    }, { passive: true });

    window.addEventListener('touchend', handleEnd);

    gridEl.addEventListener('mousedown', (e) => {
        handleStart(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragStartCoord) return;
        handleMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', handleEnd);

    // Swap Logic
    async function executeSwap(r1, c1, r2, c2) {
        isProcessing = true;

        // Swap in array
        let tempF = board[r1][c1];
        board[r1][c1] = board[r2][c2];
        board[r2][c2] = tempF;

        let tempS = specialBoard[r1][c1];
        specialBoard[r1][c1] = specialBoard[r2][c2];
        specialBoard[r2][c2] = tempS;

        renderBoard();

        let matches = checkMatches();

        if (matches.length > 0) {
            await resolveMatches();
        } else {
            await new Promise(res => setTimeout(res, 220));
            // Swap back
            board[r2][c2] = board[r1][c1];
            board[r1][c1] = tempF;

            specialBoard[r2][c2] = specialBoard[r1][c1];
            specialBoard[r1][c1] = tempS;

            renderBoard();
            isProcessing = false;
        }
    }

    function checkMatches() {
        let matchedCoords = new Map();

        // Horizontal
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE - 2; c++) {
                let f = board[r][c];
                if (!f) continue;
                let len = 1;
                while (c + len < GRID_SIZE && board[r][c + len] === f) {
                    len++;
                }
                if (len >= 3) {
                    for (let k = 0; k < len; k++) {
                        matchedCoords.set(`${r},${c+k}`, { row: r, col: c+k, count: len });
                    }
                    c += len - 1;
                }
            }
        }

        // Vertical
        for (let c = 0; c < GRID_SIZE; c++) {
            for (let r = 0; r < GRID_SIZE - 2; r++) {
                let f = board[r][c];
                if (!f) continue;
                let len = 1;
                while (r + len < GRID_SIZE && board[r + len][c] === f) {
                    len++;
                }
                if (len >= 3) {
                    for (let k = 0; k < len; k++) {
                        const key = `${r+k},${c}`;
                        const existing = matchedCoords.get(key);
                        const maxCount = existing ? Math.max(existing.count, len) : len;
                        matchedCoords.set(key, { row: r+k, col: c, count: maxCount });
                    }
                    r += len - 1;
                }
            }
        }

        let result = [];
        matchedCoords.forEach((val) => {
            result.push({
                row: val.row,
                col: val.col,
                fruit: board[val.row][val.col],
                special: specialBoard[val.row][val.col],
                matchCount: val.count
            });
        });
        return result;
    }

    // Match Resolution Loop
    async function resolveMatches() {
        let matches = checkMatches();
        let comboCount = 0;

        while (matches.length > 0) {
            comboCount++;
            playSound('pop', comboCount);
            playSound('explosion');

            triggerScreenShake(matches.length > 4 || comboCount > 1);

            let points = matches.length * 20 * comboCount;
            score += points;
            addXPAndRestoreTime(points);

            // Check for Special Fruit creation (4 = Laser Line, 5+ = Rainbow Bomb)
            let specialToSpawn = null;
            if (matches.length >= 5) {
                specialToSpawn = { type: 'rainbow', row: matches[0].row, col: matches[0].col };
            } else if (matches.length === 4) {
                specialToSpawn = { type: 'laser', row: matches[0].row, col: matches[0].col };
            }

            showFeedback(comboCount > 1 ? `COMBO DEMAIS x${comboCount}! +${points}` : `CORTE SUCULENTO! +${points}`);

            const gridRect = gridEl.getBoundingClientRect();

            matches.forEach(m => {
                const idx = m.row * GRID_SIZE + m.col;
                const cell = gridEl.children[idx];
                if (!cell) return;

                const cellRect = cell.getBoundingClientRect();
                const centerX = cellRect.left - gridRect.left + cellRect.width / 2;
                const centerY = cellRect.top - gridRect.top + cellRect.height / 2;

                // Trigger Special Bomb/Laser clearing
                if (m.special === 'laser') {
                    playSound('special');
                    triggerLaserBlast(m.row, m.col);
                } else if (m.special === 'rainbow') {
                    playSound('special');
                    triggerRainbowExplosion(m.fruit);
                }

                createSliceEffect(cell, m.fruit);
                createJuiceSplash(gridEl, centerX, centerY, FRUIT_COLORS[m.fruit] || '#ffffff');
                createBoardStain(cell, FRUIT_COLORS[m.fruit] || '#ffffff');
                createSlashLine(gridEl, centerX, centerY);
                createFloatingScore(gridEl, centerX, centerY, comboCount > 1 ? `CRÍTICO! +${points}` : `+${points}`, FRUIT_COLORS[m.fruit]);
                spawnAmbientSparkles(cellRect.left + cellRect.width/2, cellRect.top + cellRect.height/2, FRUIT_COLORS[m.fruit], 12);
            });

            await new Promise(r => setTimeout(r, 700));

            // Clear matched board slots
            matches.forEach(m => {
                board[m.row][m.col] = null;
                specialBoard[m.row][m.col] = null;
            });

            // Insert created Special Fruit if applicable
            if (specialToSpawn) {
                board[specialToSpawn.row][specialToSpawn.col] = getRandomFruit();
                specialBoard[specialToSpawn.row][specialToSpawn.col] = specialToSpawn.type;
            }

            applyGravity();
            renderBoard();

            await new Promise(r => setTimeout(r, 350));
            matches = checkMatches();
        }

        isProcessing = false;
        if (!hasPossibleMoves()) {
            showFeedback('Sem Movimentos! Embaralhando...');
            setTimeout(() => shuffleBoard(), 800);
        }
    }

    function triggerLaserBlast(row, col) {
        for (let i = 0; i < GRID_SIZE; i++) {
            board[row][i] = null;
            board[i][col] = null;
        }
    }

    function triggerRainbowExplosion(targetFruit) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (board[r][c] === targetFruit) {
                    board[r][c] = null;
                }
            }
        }
    }

    // Visual Effects Generators
    function createSliceEffect(cellEl, fruitChar) {
        cellEl.innerHTML = '';

        const leftHalf = document.createElement('div');
        leftHalf.className = 'absolute text-3xl sm:text-4xl slice-left pointer-events-none z-30';
        leftHalf.style.clipPath = 'polygon(0 0, 55% 0, 45% 100%, 0 100%)';
        leftHalf.textContent = fruitChar;

        const rightHalf = document.createElement('div');
        rightHalf.className = 'absolute text-3xl sm:text-4xl slice-right pointer-events-none z-30';
        rightHalf.style.clipPath = 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)';
        rightHalf.textContent = fruitChar;

        cellEl.appendChild(leftHalf);
        cellEl.appendChild(rightHalf);
    }

    function createSlashLine(container, cx, cy) {
        const line = document.createElement('div');
        line.className = 'slash-line';

        const angle = Math.floor(Math.random() * 60) - 30;
        line.style.setProperty('--slash-angle', `${angle}deg`);
        line.style.width = '80px';
        line.style.left = `${cx - 40}px`;
        line.style.top = `${cy - 2}px`;

        container.appendChild(line);
        setTimeout(() => line.remove(), 450);
    }

    function createJuiceSplash(container, cx, cy, color) {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'juice-particle';

            const size = Math.floor(Math.random() * 8) + 6;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.floor(Math.random() * 60) + 30;

            const dx = `${Math.cos(angle) * distance}px`;
            const dy = `${Math.sin(angle) * distance}px`;

            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            particle.style.backgroundColor = color;
            particle.style.color = color;
            particle.style.left = `${cx - size / 2}px`;
            particle.style.top = `${cy - size / 2}px`;
            particle.style.setProperty('--dx', dx);
            particle.style.setProperty('--dy', dy);

            container.appendChild(particle);
            setTimeout(() => particle.remove(), 850);
        }
    }

    function createBoardStain(cellEl, color) {
        const stain = document.createElement('div');
        stain.className = 'splat-stain w-full h-full';
        stain.style.backgroundColor = color;
        cellEl.appendChild(stain);
        setTimeout(() => stain.remove(), 2500);
    }

    function createFloatingScore(container, cx, cy, text, color = '#ffffff') {
        const el = document.createElement('div');
        el.className = 'floating-text text-sm sm:text-base font-black';
        el.style.color = color;
        el.style.setProperty('--glow-color', color);
        el.textContent = text;
        el.style.left = `${cx}px`;
        el.style.top = `${cy}px`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 900);
    }

    function triggerScreenShake(heavy = false) {
        const app = document.getElementById('app');
        app.classList.remove('shake-light', 'shake-heavy');
        void app.offsetWidth;
        app.classList.add(heavy ? 'shake-heavy' : 'shake-light');
        setTimeout(() => app.classList.remove('shake-light', 'shake-heavy'), 450);
    }

    function applyGravity() {
        for (let c = 0; c < GRID_SIZE; c++) {
            let emptyRow = GRID_SIZE - 1;
            for (let r = GRID_SIZE - 1; r >= 0; r--) {
                if (board[r][c] !== null) {
                    board[emptyRow][c] = board[r][c];
                    specialBoard[emptyRow][c] = specialBoard[r][c];
                    if (emptyRow !== r) {
                        board[r][c] = null;
                        specialBoard[r][c] = null;
                    }
                    emptyRow--;
                }
            }
            for (let r = emptyRow; r >= 0; r--) {
                board[r][c] = getRandomFruit();
                specialBoard[r][c] = null;
            }
        }
    }

    function showFeedback(text) {
        const banner = document.getElementById('feedback-banner');
        banner.textContent = text;
        banner.classList.remove('opacity-0', 'scale-90');
        banner.classList.add('opacity-100', 'scale-110');
        setTimeout(() => {
            banner.classList.remove('opacity-100', 'scale-110');
            banner.classList.add('opacity-0', 'scale-90');
        }, 1100);
    }

    function hasPossibleMoves() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (c < GRID_SIZE - 1) {
                    let temp = board[r][c];
                    board[r][c] = board[r][c+1];
                    board[r][c+1] = temp;
                    let hasMatch = checkMatches().length > 0;
                    board[r][c+1] = board[r][c];
                    board[r][c] = temp;
                    if (hasMatch) return true;
                }
                if (r < GRID_SIZE - 1) {
                    let temp = board[r][c];
                    board[r][c] = board[r+1][c];
                    board[r+1][c] = temp;
                    let hasMatch = checkMatches().length > 0;
                    board[r+1][c] = board[r][c];
                    board[r][c] = temp;
                    if (hasMatch) return true;
                }
            }
        }
        return false;
    }

    function shuffleBoard() {
        do {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    board[r][c] = getRandomFruit();
                    specialBoard[r][c] = null;
                }
            }
        } while (checkMatches().length > 0 || !hasPossibleMoves());
        renderBoard();
    }

    function triggerGameOver() {
        isGameOver = true;
        stopMusic();
        playSound('gameover');

        document.getElementById('game-over-level').textContent = currentLevel;
        document.getElementById('final-score').textContent = score;

        saveGameStats(score, currentLevel);
        openModal('game-over-modal');
    }

    // Button Event Listeners
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-how-to-play').addEventListener('click', () => openModal('how-to-play-modal'));
    document.getElementById('btn-high-scores').addEventListener('click', () => openModal('high-scores-modal'));
    document.getElementById('sound-toggle-btn').addEventListener('click', toggleSound);

    document.getElementById('btn-close-how-to').addEventListener('click', () => closeModal('how-to-play-modal'));
    document.getElementById('btn-close-scores').addEventListener('click', () => closeModal('high-scores-modal'));

    document.getElementById('btn-pause').addEventListener('click', () => openModal('pause-modal'));
    document.getElementById('btn-resume').addEventListener('click', () => closeModal('pause-modal'));
    document.getElementById('btn-restart-pause').addEventListener('click', restartGame);
    document.getElementById('btn-menu-pause').addEventListener('click', returnToMenu);

    document.getElementById('btn-restart-over').addEventListener('click', restartGame);
    document.getElementById('btn-menu-over').addEventListener('click', returnToMenu);

    updateBestScoreDisplay();
});