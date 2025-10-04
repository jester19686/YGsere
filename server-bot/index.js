require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не задан в .env');
  process.exit(1);
}

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

const bot = new Telegraf(BOT_TOKEN, {
  telegram: {
    apiRoot: process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org',
    agent,
  },
});

bot.start(async (ctx) => {
  const user = ctx.from;
  const payload = (ctx.startPayload || '').trim();
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `tg_${user.id}`;
  if (payload && payload.startsWith('AUTH_')) {
    const token = payload.slice('AUTH_'.length);
    await ctx.reply('Авторизация через сайт', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Авторизовать', callback_data: `AUTH:${token}` }]],
      },
    });
    return;
  }

  if (payload) {
    // совместимость со старыми кодами
    try {
      const resp = await fetch(process.env.APP_BASE_URL + '/api/auth/tg/otp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: payload,
          id: user.id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          photo_url: null,
        })
      });
      const ok = resp.ok;
      await ctx.reply(ok ? `Готово. Возвращайтесь на сайт.` : `Не удалось подтвердить.`);
    } catch (e) {
      await ctx.reply('Ошибка подтверждения. Попробуйте снова.');
    }
    return;
  }

  await ctx.reply(`Привет, ${name}! Нажмите кнопку «Авторизовать» на сайте.`);
});

bot.on('message', async (ctx) => {
  await ctx.reply('Я бот авторизации. Используйте /start из ссылки на сайте для входа.');
});

bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery?.data || '';
    if (!data.startsWith('AUTH:')) return ctx.answerCbQuery();
    const token = data.slice('AUTH:'.length);
    const user = ctx.from;
    const resp = await fetch(process.env.APP_BASE_URL + '/api/auth/tg/otp/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `AUTH_${token}`,
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        photo_url: null,
      })
    });
    let ok = false;
    try {
      const js = await resp.json();
      ok = !!js?.ok && js?.status === 'confirmed';
    } catch { ok = resp.ok; }
    await ctx.answerCbQuery(ok ? 'Успешно' : 'Ошибка');
    const site = process.env.FRONT_BASE_URL || 'http://localhost:3000/lobby';
    const backUrl = `${site}${site.includes('?') ? '&' : '?'}auth=${encodeURIComponent(token)}`;
    try {
      await ctx.editMessageText(ok ? '✅ Авторизовано. Вернитесь на сайт.' : '❌ Не удалось авторизовать.', {
        reply_markup: ok ? { inline_keyboard: [[{ text: 'Перейти на сайт', url: backUrl }]] } : undefined,
      });
    } catch {}
    // удалим кнопку, чтобы не нажимали повторно
    try {
      if (!ok) await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {}
    // очистим старые сообщения чата от предыдущих попыток (лёгкая очистка)
    try {
      const chatId = ctx.chat?.id;
      const msgId = ctx.callbackQuery?.message?.message_id;
      if (chatId && msgId) {
        for (let i = 1; i <= 3; i++) {
          try { await ctx.telegram.deleteMessage(chatId, msgId - i); } catch {}
        }
      }
    } catch {}
    // Дополнительно отправим отдельным сообщением кнопку на сайт, на случай если редактирование не прошло
    if (ok) {
      try {
        await ctx.reply('Перейти на сайт', {
          reply_markup: { inline_keyboard: [[{ text: 'Перейти на сайт', url: backUrl }]] }
        });
      } catch {}
      try { await ctx.reply(`Ссылка: ${backUrl}`); } catch {}
    }
  } catch {
    try { await ctx.answerCbQuery('Ошибка'); } catch {}
  }
});

async function launchWithRetry() {
  const RETRY_MS = Number(process.env.BOT_RETRY_MS || 10000);
  try {
    try { await bot.telegram.deleteWebhook({ drop_pending_updates: true }); } catch {}
    await bot.launch({
      allowedUpdates: ['message','callback_query']
    });
    console.log('server-bot запущен');
  } catch (e) {
    console.error('Ошибка запуска бота:', e?.message || e);
    console.log(`Повторный запуск через ${Math.round(RETRY_MS/1000)}с...`);
    setTimeout(launchWithRetry, RETRY_MS);
  }
}

launchWithRetry();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


