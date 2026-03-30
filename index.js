const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.goto('https://raspisanie.doyupk.ru/', { waitUntil: 'networkidle2' });
        
        // Выбираем "Группа"
        await page.waitForSelector('input[value="group"]');
        await page.click('input[value="group"]');
        
        // Вводим название группы
        await page.waitForSelector('input[placeholder="Поиск группы"]');
        await page.type('input[placeholder="Поиск группы"]', 'СЭЗ-24-2');
        
        // Ждем и выбираем из выпадающего списка
        await page.waitForTimeout(2000);
        await page.click('.ui-menu-item');
        
        await page.waitForTimeout(3000);
        
        // Парсим расписание на сегодня
        const schedule = await page.evaluate(() => {
            const today = new Date().toLocaleDateString('ru-RU');
            const rows = document.querySelectorAll('tr');
            let todaySchedule = [];
            let found = false;
            
            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2 && cells[0].innerText.includes(today)) {
                    found = true;
                }
                if (found && cells.length >= 2) {
                    const time = cells[0]?.innerText.trim() || '';
                    let subject = cells[1]?.innerText.trim() || '';
                    if (subject.includes('(подгруппа 1)')) {
                        subject = subject.replace('(подгруппа 1)', '').trim();
                    }
                    if (time && subject && !subject.includes('Расписание') && !subject.includes('завтра')) {
                        todaySchedule.push({ time, subject });
                    }
                }
                if (found && cells.length && cells[0]?.innerText.includes('завтра')) {
                    break;
                }
            }
            return todaySchedule;
        });
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Расписание СЭЗ-24-2 (1 подгруппа)</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    background: linear-gradient(135deg, #0b2b44 0%, #1a4a6f 100%);
                    min-height: 100vh;
                    padding: 20px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .card {
                    max-width: 650px;
                    width: 100%;
                    background: white;
                    border-radius: 32px;
                    padding: 28px;
                    box-shadow: 0 25px 45px rgba(0,0,0,0.2);
                }
                h1 {
                    font-size: 28px;
                    text-align: center;
                    color: #0b2b44;
                    margin-bottom: 8px;
                }
                .subgroup {
                    text-align: center;
                    font-weight: 600;
                    color: #1a4a6f;
                    background: #e8f0fe;
                    display: inline-block;
                    width: auto;
                    margin: 0 auto 20px;
                    padding: 6px 18px;
                    border-radius: 40px;
                    font-size: 14px;
                }
                .date {
                    text-align: center;
                    font-size: 18px;
                    font-weight: 500;
                    color: #2c3e66;
                    margin: 20px 0 20px;
                    padding-bottom: 12px;
                    border-bottom: 2px solid #eef2f7;
                }
                .pair {
                    background: #f9fafc;
                    border-radius: 20px;
                    padding: 16px 18px;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                    border-left: 4px solid #1a4a6f;
                }
                .time {
                    font-weight: 700;
                    color: #1a4a6f;
                    min-width: 90px;
                    font-size: 15px;
                }
                .subject {
                    color: #1f2f44;
                    font-weight: 500;
                }
                .empty {
                    text-align: center;
                    padding: 40px 20px;
                    color: #7f8c8d;
                    background: #f9fafc;
                    border-radius: 24px;
                    font-size: 16px;
                }
                button {
                    background: #0b2b44;
                    color: white;
                    border: none;
                    width: 100%;
                    padding: 14px;
                    font-size: 16px;
                    font-weight: 600;
                    border-radius: 40px;
                    cursor: pointer;
                    margin-top: 20px;
                    transition: 0.2s;
                }
                button:hover {
                    background: #1a4a6f;
                    transform: scale(0.98);
                }
                .footer {
                    text-align: center;
                    font-size: 11px;
                    color: #94a3b8;
                    margin-top: 20px;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📖 Расписание</h1>
                <div style="text-align: center;"><span class="subgroup">СЭЗ-24-2 | Подгруппа I</span></div>
                <div class="date">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                
                ${schedule.length > 0 ? schedule.map(p => `
                    <div class="pair">
                        <div class="time">${p.time || '—'}</div>
                        <div class="subject">${p.subject}</div>
                    </div>
                `).join('') : '<div class="empty">🎓 На сегодня пар нет<br>или расписание еще не загружено</div>'}
                
                <button onclick="location.reload()">🔄 Обновить сейчас</button>
                <div class="footer">Данные с raspisanie.doyupk.ru • автоматическое обновление</div>
            </div>
        </body>
        </html>
        `;
        
        res.send(html);
        
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).send(`
            <div style="font-family: system-ui; text-align: center; padding: 40px;">
                <h2>⚠️ Не удалось загрузить расписание</h2>
                <p>Сайт с расписанием временно недоступен или изменилась структура.</p>
                <button onclick="location.reload()">Попробовать снова</button>
            </div>
        `);
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(\`Сервер запущен на порту \${PORT}\`);
});
