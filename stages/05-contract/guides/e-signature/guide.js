'use strict';

const imageModal = document.getElementById('image-modal');
const modalPreview = document.getElementById('image-modal-preview');
const modalTitle = document.getElementById('image-modal-title');

imageModal.addEventListener('show.bs.modal', (event) => {
  const trigger = event.relatedTarget;
  const source = trigger?.querySelector('img');
  if (!source) return;

  modalPreview.src = source.getAttribute('src');
  modalPreview.alt = source.alt;
  modalTitle.textContent = trigger.getAttribute('aria-label').replace(/^放大 /, '');
});

imageModal.addEventListener('hidden.bs.modal', () => {
  modalPreview.removeAttribute('src');
  modalPreview.alt = '';
});
