// =====================================================
// UTILIDADES DE RENDERIZADO Y DOM
// Funciones ligeras para manejar actualizaciones del DOM de forma
// eficiente y evitar reflows innecesarios.
// =====================================================

const updateQueue = [];
let rafId = null;

function flushQueue() {
    const tasks = updateQueue.splice(0, updateQueue.length);
    rafId = null;

    for (const task of tasks) {
        try {
            task();
        } catch (error) {
            console.error('❌ Error al ejecutar actualización diferida del DOM:', error);
        }
    }
}

export function scheduleDOMUpdate(callback) {
    if (typeof callback !== 'function') {
        return;
    }

    updateQueue.push(callback);

    if (rafId === null) {
        rafId = requestAnimationFrame(flushQueue);
    }
}

export function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function toFragment(markup) {
    if (markup instanceof DocumentFragment) {
        return markup;
    }

    if (markup instanceof Node) {
        const fragment = document.createDocumentFragment();
        fragment.appendChild(markup);
        return fragment;
    }

    const template = document.createElement('template');
    template.innerHTML = markup ?? '';
    return template.content;
}

export function renderTemplate(container, template, options = {}) {
    if (!container) {
        return null;
    }

    const { beforeRender, afterRender, replace = true, defer = false } = options;
    const markup = typeof template === 'function' ? template() : template;

    const execute = () => {
        if (typeof beforeRender === 'function') {
            beforeRender(container);
        }

        const fragment = toFragment(markup);
        const fragmentClone = fragment.cloneNode(true);

        if (replace) {
            container.replaceChildren(fragmentClone);
        } else {
            container.appendChild(fragmentClone);
        }

        if (typeof afterRender === 'function') {
            afterRender(container);
        }
    };

    if (defer) {
        scheduleDOMUpdate(execute);
    } else {
        execute();
    }

    return container;
}

export function clearElement(element) {
    if (!element) {
        return;
    }
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

export function bindEventOnce(element, eventName, handler, options) {
    if (!element || typeof handler !== 'function') {
        return;
    }

    const onceHandler = (event) => {
        element.removeEventListener(eventName, onceHandler, options);
        handler(event);
    };

    element.addEventListener(eventName, onceHandler, options);
}

export function toggleClass(element, className, force) {
    if (!element || !className) {
        return;
    }

    if (force === undefined) {
        element.classList.toggle(className);
    } else {
        element.classList.toggle(className, Boolean(force));
    }
}
