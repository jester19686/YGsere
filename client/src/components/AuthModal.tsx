'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from 'lucide-react';

type AuthModalProps = {
  open: boolean;
  nick: string;
  onChangeNick: (value: string) => void;
  onConfirm: () => void;
  onClose?: () => void;
  onTelegramAuth?: () => void;
};

const AuthModal: React.FC<AuthModalProps> = ({ open, nick, onChangeNick, onConfirm, onClose, onTelegramAuth }) => {
  const RAW_API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:4000`
      : 'http://localhost:4000');
  const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

  const widgetMountedRef = useRef(false);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // Автоматически загружаем виджет при открытии модалки
  useEffect(() => {
    if (open && !widgetMountedRef.current) {
      console.log('[TG Widget] Модалка открыта, автоматически загружаем виджет');
      handleTelegramAuthInternal();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTelegramAuthInternal = useCallback(() => {
    console.log('[TG Widget] Начало инициализации виджета');
    try {
      if (widgetMountedRef.current) {
        console.log('[TG Widget] Виджет уже смонтирован, пропускаем');
        return;
      }
      widgetMountedRef.current = true;
      console.log('[TG Widget] Регистрируем callback функцию');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__tgAuthCb = async (user: any) => {
        console.log('[TG Auth] Callback вызван с user:', user);
        console.log('[TG Auth] API_BASE:', API_BASE);
        try {
          const url = `${API_BASE}/api/auth/telegram/verify`;
          console.log('[TG Auth] Отправка запроса на:', url);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          });
          console.log('[TG Auth] Ответ статус:', res.status);
          const data = await res.json();
          console.log('[TG Auth] Ответ данные:', data);
          if (data?.ok && data?.profile) {
            const name: string = data.profile.name || '';
            const avatarUrl: string | null = data.profile.avatarUrl || null;
            console.log('[TG Auth] Успех! Имя:', name, 'Avatar:', avatarUrl);
            if (name) onChangeNick(name);
            try { if (avatarUrl) localStorage.setItem('bunker:avatar', avatarUrl); } catch {}
            console.log('[TG Auth] Ждём обновления состояния и вызываем onConfirm()');
            // Даём React время обновить состояние nick перед вызовом onConfirm
            setTimeout(() => {
              onConfirm();
            }, 50);
          } else {
            console.error('[TG Auth] Неудача:', data);
            setWidgetError('Не удалось подтвердить данные Telegram');
          }
        } catch (e) {
          console.error('[TG Auth] Ошибка:', e);
          setWidgetError('Ошибка связи с сервером');
        }
      };
      const botUsername = process.env.NEXT_PUBLIC_TG_BOT_USERNAME || 'BunkerAuthbot';
      console.log('[TG Widget] Bot username:', botUsername);
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', botUsername);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-userpic', 'false');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-onauth', '__tgAuthCb(user)');
      
      script.onload = () => {
        console.log('[TG Widget] Скрипт виджета загружен');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log('[TG Widget] Callback зарегистрирован:', typeof (window as any).__tgAuthCb);
      };
      script.onerror = (err) => {
        console.error('[TG Widget] Ошибка загрузки скрипта:', err);
        setWidgetError('Не удалось загрузить виджет Telegram');
      };
      
      if (widgetContainerRef.current) {
        console.log('[TG Widget] Добавляем скрипт в DOM');
        widgetContainerRef.current.innerHTML = '';
        widgetContainerRef.current.appendChild(script);
      } else {
        console.error('[TG Widget] widgetContainerRef.current is null!');
      }
    } catch (err) {
      console.error('[TG Widget] Исключение при создании виджета:', err);
      setWidgetError('Не удалось встроить виджет Telegram');
    }
  }, [API_BASE, onChangeNick, onConfirm, onTelegramAuth]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => onClose?.()}
          role="dialog"
          aria-modal="true"
          aria-label="Авторизация"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
              >
                <User className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-2xl font-bold text-white mb-2">Добро пожаловать!</h3>
              <p className="text-gray-300 text-sm">Выберите способ авторизации</p>
            </div>

            <div className="space-y-6">
              {/* Контейнер для Telegram Login Widget - загружается автоматически */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                ref={widgetContainerRef}
                className="flex justify-center min-h-[46px]"
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-transparent text-gray-400">или</span>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                <div className="relative">
                  <input
                    autoFocus
                    className="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 focus:bg-white/15 transition-all duration-300 peer pl-12"
                    placeholder="Введите ваш никнейм"
                    value={nick}
                    onChange={(e) => onChangeNick(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && nick.trim()) onConfirm(); }}
                    aria-label="Никнейм"
                  />
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 peer-focus:text-indigo-400 transition-colors duration-300" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  disabled={!nick.trim()}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:shadow-gray-500/25 transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <span>Продолжить</span>
                  <motion.div
                    initial={{ x: 0 }}
                    whileHover={{ x: 4 }}
                    transition={{ duration: 0.2 }}
                  >
                    →
                  </motion.div>
                </motion.button>
              </motion.div>
            </div>

            <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full opacity-60"></div>
            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full opacity-40"></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;


