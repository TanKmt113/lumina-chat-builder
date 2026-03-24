(function() {
  const script = document.currentScript;
  const chatbotId = script.getAttribute('data-chatbot-id');
  if (!chatbotId) {
    console.error('FoxAI Chat: Missing data-chatbot-id attribute');
    return;
  }

  const baseUrl = script.src.split('/widget.js')[0];
  const iframeUrl = `${baseUrl}/widget/${chatbotId}`;

  // Create iframe container
  const container = document.createElement('div');
  container.id = 'foxai-chat-container';
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.right = '0';
  container.style.zIndex = '999999';
  container.style.width = '450px';
  container.style.height = '700px';
  container.style.pointerEvents = 'none'; // Allow clicking through to underlying site when closed
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'flex-end';
  container.style.justifyContent = 'flex-end';

  const iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.pointerEvents = 'auto'; // Re-enable pointer events for the iframe content
  iframe.style.background = 'transparent';
  iframe.allow = 'microphone';

  container.appendChild(iframe);
  document.body.appendChild(container);

  // Handle responsiveness if needed
  const updateSize = () => {
    if (window.innerWidth < 640) {
      container.style.width = '100%';
      container.style.height = '100%';
    } else {
      container.style.width = '450px';
      container.style.height = '700px';
    }
  };
  window.addEventListener('resize', updateSize);
  updateSize();
})();
