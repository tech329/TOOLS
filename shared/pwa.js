(function () {
    'use strict';

    const VERSION_FALLBACK = (window.APP_CONFIG && window.APP_CONFIG.APP_VERSION) || '2.1.2';
    const STORAGE_KEYS = {
        version: 'tupak_pwa_current_version',
        seen: 'tupak_pwa_seen_version',
        accepted210: 'tupak_pwa_release_2_1_0_accepted'
    };

    let registrationRef = null;
    let pendingWorker = null;
    let controllerRefreshTriggered = false;

    function getCurrentSection() {
        const path = window.location.pathname.replace(/\\/g, '/');
        if (path.includes('/pc/')) {
            return 'pc';
        }
        if (path.includes('/mobile/')) {
            return 'mobile';
        }
        return '';
    }

    function getRelativeRoot() {
        const path = window.location.pathname.replace(/\\/g, '/');
        const segments = path.split('/').filter(Boolean);
        const sectionIndex = segments.findIndex(segment => segment === 'pc' || segment === 'mobile');

        if (sectionIndex === -1) {
            return './';
        }

        const currentDirectoryDepth = Math.max(segments.length - 1, 0);
        const appRootDepth = sectionIndex;
        const levelsUp = Math.max(currentDirectoryDepth - appRootDepth, 0);

        return levelsUp === 0 ? './' : '../'.repeat(levelsUp);
    }

    function getManifestHref() {
        const root = getRelativeRoot();
        const section = getCurrentSection();
        if (section === 'pc') {
            return root + 'manifest-pc.webmanifest';
        }
        if (section === 'mobile') {
            return root + 'manifest-mobile.webmanifest';
        }
        return root + 'manifest.webmanifest';
    }

    function ensureManifestLink() {
        if (document.querySelector('link[rel="manifest"]')) {
            return;
        }
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = getManifestHref();
        document.head.appendChild(link);
    }

    function ensureThemeMeta() {
        if (document.querySelector('meta[name="theme-color"]')) {
            return;
        }
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#001749';
        document.head.appendChild(meta);
    }

    function ensureAppleMeta() {
        if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
            const meta = document.createElement('meta');
            meta.name = 'apple-mobile-web-app-capable';
            meta.content = 'yes';
            document.head.appendChild(meta);
        }
    }

    function getModalStyles() {
        return `
            .tupak-update-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 23, 73, 0.62);
                backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                z-index: 99999;
            }
            .tupak-update-modal {
                width: min(100%, 460px);
                border-radius: 24px;
                overflow: hidden;
                background: linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%);
                box-shadow: 0 30px 80px rgba(0, 23, 73, 0.28);
                border: 1px solid rgba(1, 92, 208, 0.14);
                animation: tupakUpdateIn 220ms ease-out;
            }
            .tupak-update-head {
                padding: 22px 22px 18px;
                background: linear-gradient(135deg, #001749 0%, #015cd0 70%, #3787c6 100%);
                color: #fff;
            }
            .tupak-update-chip {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.16);
                border: 1px solid rgba(255, 255, 255, 0.18);
                padding: 7px 12px;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                margin-bottom: 14px;
            }
            .tupak-update-head h3 {
                margin: 0;
                font-size: 24px;
                line-height: 1.1;
                font-weight: 800;
            }
            .tupak-update-head p {
                margin: 10px 0 0;
                color: rgba(255, 255, 255, 0.86);
                line-height: 1.55;
                font-size: 14px;
            }
            .tupak-update-body {
                padding: 22px;
                color: #24324a;
            }
            .tupak-update-list {
                margin: 0 0 18px;
                padding: 0;
                list-style: none;
                display: grid;
                gap: 10px;
            }
            .tupak-update-list li {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                background: rgba(1, 92, 208, 0.05);
                border: 1px solid rgba(1, 92, 208, 0.08);
                border-radius: 16px;
                padding: 12px 14px;
                font-size: 14px;
                line-height: 1.45;
            }
            .tupak-update-list i {
                color: #015cd0;
                margin-top: 2px;
            }
            .tupak-update-foot {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .tupak-update-btn {
                appearance: none;
                border: 0;
                border-radius: 14px;
                padding: 13px 16px;
                font-weight: 700;
                cursor: pointer;
                transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
            }
            .tupak-update-btn:hover {
                transform: translateY(-1px);
            }
            .tupak-update-btn-primary {
                flex: 1 1 220px;
                background: linear-gradient(135deg, #e48410, #f59e0b);
                color: white;
                box-shadow: 0 16px 26px rgba(228, 132, 16, 0.28);
            }
            .tupak-update-btn-secondary {
                flex: 1 1 140px;
                background: #e9eef7;
                color: #001749;
            }
            @keyframes tupakUpdateIn {
                from { opacity: 0; transform: translateY(18px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
    }

    function ensureModalStyles() {
        if (document.getElementById('tupak-pwa-style')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'tupak-pwa-style';
        style.textContent = getModalStyles();
        document.head.appendChild(style);
    }

    function updateVersionLabels(version) {
        const normalized = version || VERSION_FALLBACK;
        document.querySelectorAll('[data-app-version]').forEach(node => {
            node.textContent = normalized;
        });
    }

    function closeModal() {
        const modal = document.getElementById('tupak-update-backdrop');
        if (modal) {
            modal.remove();
        }
    }

    function hasAcceptedPersistentReleaseNotice() {
        return localStorage.getItem(STORAGE_KEYS.accepted210) === 'true';
    }

    function markPersistentReleaseNoticeAccepted() {
        localStorage.setItem(STORAGE_KEYS.accepted210, 'true');
        localStorage.setItem(STORAGE_KEYS.seen, VERSION_FALLBACK);
    }

    function showUpdateModal(version, isReloadAvailable) {
        ensureModalStyles();
        closeModal();

        const backdrop = document.createElement('div');
        backdrop.id = 'tupak-update-backdrop';
        backdrop.className = 'tupak-update-backdrop';
        backdrop.innerHTML = `
            <div class="tupak-update-modal" role="dialog" aria-modal="true" aria-labelledby="tupak-update-title">
                <div class="tupak-update-head">
                    <div class="tupak-update-chip"><i class="fas fa-sparkles"></i><span>Actualización menor</span></div>
                    <h3 id="tupak-update-title">Nueva versión ${version}</h3>
                    <p>Ya puedes usar cartera y generar actas con una experiencia más completa tanto en PC como en móvil.</p>
                </div>
                <div class="tupak-update-body">
                    <ul class="tupak-update-list">
                        <li><i class="fas fa-wallet"></i><span>Cartera ya está disponible con su flujo operativo activo y ahora también cuenta con versión móvil.</span></li>
                        <li><i class="fas fa-file-signature"></i><span>Ya puedes generar actas y también reimprimir actas de los últimos créditos; antes de crear una nueva, busca primero por cédula.</span></li>
                        <li><i class="fas fa-chart-line"></i><span>Créditos incorpora la nueva vista de estadísticas para revisar montos, capital vigente y evolución reciente.</span></li>
                        <li><i class="fas fa-bell"></i><span>Enviar recordatorios en créditos ahora tiene una función adicional distinta para reforzar la gestión de cobros y seguimiento.</span></li>
                    </ul>
                    <div class="tupak-update-foot">
                        <button type="button" id="tupak-update-primary" class="tupak-update-btn tupak-update-btn-primary">Aceptar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        document.getElementById('tupak-update-primary').addEventListener('click', () => {
            markPersistentReleaseNoticeAccepted();
            closeModal();
            if (isReloadAvailable && pendingWorker) {
                pendingWorker.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }

    function maybeAnnounceVersion(version, isReloadAvailable) {
        const normalized = version || VERSION_FALLBACK;
        localStorage.setItem(STORAGE_KEYS.version, normalized);
        updateVersionLabels(normalized);

        if (hasAcceptedPersistentReleaseNotice()) {
            return;
        }

        const seenVersion = localStorage.getItem(STORAGE_KEYS.seen);
        if (seenVersion === normalized && !isReloadAvailable) {
            return;
        }

        showUpdateModal(normalized, isReloadAvailable);
    }

    function watchInstallingWorker(worker) {
        if (!worker) {
            return;
        }
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                        pendingWorker = worker;
                        maybeAnnounceVersion(VERSION_FALLBACK, true);
                }
            }
        });
    }

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            updateVersionLabels(VERSION_FALLBACK);
            return;
        }

        ensureManifestLink();
        ensureThemeMeta();
        ensureAppleMeta();

        try {
            registrationRef = await navigator.serviceWorker.register(getRelativeRoot() + 'sw.js', {
                scope: getRelativeRoot()
            });

            if (registrationRef.waiting) {
                pendingWorker = registrationRef.waiting;
                maybeAnnounceVersion(VERSION_FALLBACK, true);
            }

            if (registrationRef.installing) {
                watchInstallingWorker(registrationRef.installing);
            }

            registrationRef.addEventListener('updatefound', () => {
                watchInstallingWorker(registrationRef.installing);
            });

            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SW_VERSION') {
                    maybeAnnounceVersion(event.data.version, false);
                }
            });

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (controllerRefreshTriggered) {
                    return;
                }
                controllerRefreshTriggered = true;
                window.location.reload();
            });

            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' });
            } else {
                const readyRegistration = await navigator.serviceWorker.ready;
                if (readyRegistration.active) {
                    readyRegistration.active.postMessage({ type: 'GET_VERSION' });
                }
            }
        } catch (error) {
            console.error('No se pudo registrar el service worker:', error);
            updateVersionLabels(VERSION_FALLBACK);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateVersionLabels(localStorage.getItem(STORAGE_KEYS.version) || VERSION_FALLBACK);
        registerServiceWorker();
    });
})();
