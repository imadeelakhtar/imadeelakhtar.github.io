(function() {
  'use strict';

  /* ==========================================================================
     CONFIGURATION & STATE
     ========================================================================== */
  const TOTAL_FRAMES = 240;
  const FRAME_DIR = 'video_frames_24fps';
  const LERP_FACTOR = 0.09; // Buttery momentum damping factor
  const MIN_FRAMES_BEFORE_DISMISS = 18;

  // DOM Elements
  const canvas = document.getElementById('animationCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loaderOverlay = document.getElementById('loaderOverlay');
  const loaderBar = document.getElementById('loaderBar');
  const loaderText = document.getElementById('loaderText');
  const progressPercent = document.getElementById('progressPercent');
  const frameCounter = document.getElementById('frameCounter');
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-link');
  const sections = document.querySelectorAll('section[id]');
  const prevTestimonialBtn = document.getElementById('prevTestimonial');
  const nextTestimonialBtn = document.getElementById('nextTestimonial');
  const testimonialsTrack = document.getElementById('testimonialsTrack');

  // Animation Engine State
  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let targetFrame = 0;
  let currentFrame = 0;
  let renderedFrame = -1;
  let isLoaderDismissed = false;
  let isFirstFrameDrawn = false;
  let animFrameId = null;

  // Studio background sample
  let sampledBgColor = '#f8f9fc';
  let isBgSampled = false;

  /* ==========================================================================
     CANVAS SIZING & HIGH-DPI SUPPORT
     ========================================================================== */
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let dpr = window.devicePixelRatio || 1;

  function resizeCanvas() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewportWidth * dpr);
    canvas.height = Math.floor(viewportHeight * dpr);

    renderedFrame = -1;
    drawFrame(Math.round(currentFrame));
  }

  function getFramePath(index) {
    const frameNum = String(index + 1).padStart(4, '0');
    return `${FRAME_DIR}/frame_${frameNum}.png`;
  }

  /* ==========================================================================
     PRELOADING PIPELINE WITH NEAREST-FRAME FALLBACK
     ========================================================================== */
  function preloadImage(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFramePath(index);
      img.onload = () => {
        images[index] = img;
        loadedCount++;
        onFrameLoaded(index);
        resolve(img);
      };
      img.onerror = () => {
        setTimeout(() => {
          const retryImg = new Image();
          retryImg.src = getFramePath(index);
          retryImg.onload = () => {
            images[index] = retryImg;
            loadedCount++;
            onFrameLoaded(index);
            resolve(retryImg);
          };
          retryImg.onerror = () => resolve(null);
        }, 800);
      };
    });
  }

  function onFrameLoaded(index) {
    if (index === 0 && !isFirstFrameDrawn) {
      isFirstFrameDrawn = true;
      drawFrame(0);
    }

    const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
    if (loaderBar) loaderBar.style.width = `${percent}%`;
    if (loaderText) loaderText.textContent = `Loading experiences... ${percent}%`;

    if (!isLoaderDismissed && (loadedCount >= MIN_FRAMES_BEFORE_DISMISS || loadedCount === TOTAL_FRAMES)) {
      isLoaderDismissed = true;
      if (loaderOverlay) {
        loaderOverlay.classList.add('hidden');
      }
    }
  }

  function getNearestLoadedImage(targetIdx) {
    if (images[targetIdx] && images[targetIdx].complete && images[targetIdx].naturalWidth > 0) {
      return images[targetIdx];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIdx - offset;
      if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = targetIdx + offset;
      if (next < TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  function sampleImageCornerColor(img) {
    if (isBgSampled || !img || !img.naturalWidth) return;
    try {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 1;
      sampleCanvas.height = 1;
      const sCtx = sampleCanvas.getContext('2d');
      sCtx.drawImage(img, 4, 4, 1, 1, 0, 0, 1, 1);
      const pixel = sCtx.getImageData(0, 0, 1, 1).data;
      if (pixel && pixel.length >= 3) {
        sampledBgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        isBgSampled = true;
      }
    } catch (e) {
      // Fallback
    }
  }

  /* ==========================================================================
     CANVAS DRAWING ENGINE
     ========================================================================== */
  function drawFrame(frameIndex) {
    const img = getNearestLoadedImage(frameIndex);
    if (!img) return;

    if (!isBgSampled) {
      sampleImageCornerColor(img);
    }

    const w = canvas.width;
    const h = canvas.height;

    // Fill background with seamless studio tone
    ctx.fillStyle = sampledBgColor;
    ctx.fillRect(0, 0, w, h);

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;

    // Responsive scaling
    const isDesktop = w >= (1024 * dpr);
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollFrac = Math.min(Math.max(scrollY / maxScroll, 0), 1);

    // Contain scaling
    let scale = Math.min(w / imgW, h / imgH);
    if (isDesktop) {
      scale = Math.min((w * 0.95) / imgW, (h * 0.95) / imgH);
    }

    const drawW = imgW * scale;
    const drawH = imgH * scale;

    // Center alignment: on Desktop at hero section (top), align character to the right portal window
    let centerXRatio = 0.5;
    if (isDesktop) {
      // Near top of page, offset slightly to the right to fit the hero portal (x ~ 68%)
      // As you scroll down into content, smoothly ease toward 60%
      centerXRatio = 0.68 - Math.min(scrollFrac * 2, 1) * 0.08;
    }

    const drawX = (w * centerXRatio) - (drawW / 2);
    const drawY = (h - drawH) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    renderedFrame = frameIndex;
  }

  /* ==========================================================================
     SCROLL SYNCHRONIZATION & MOMENTUM LOOP
     ========================================================================== */
  function updateScrollTarget() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollFraction = Math.min(Math.max(scrollY / maxScroll, 0), 1);

    targetFrame = scrollFraction * (TOTAL_FRAMES - 1);

    if (progressPercent) {
      progressPercent.textContent = `${Math.round(scrollFraction * 100)}%`;
    }
  }

  function tick() {
    const diff = targetFrame - currentFrame;
    if (Math.abs(diff) > 0.001) {
      currentFrame += diff * LERP_FACTOR;
    } else {
      currentFrame = targetFrame;
    }

    const roundedFrame = Math.round(currentFrame);
    if (roundedFrame !== renderedFrame) {
      drawFrame(roundedFrame);
      if (frameCounter) {
        const displayNum = String(roundedFrame + 1).padStart(2, '0');
        frameCounter.textContent = `${displayNum} / ${TOTAL_FRAMES}`;
      }
    }

    animFrameId = requestAnimationFrame(tick);
  }

  async function startPreloading() {
    // Priority load frame 0 immediately
    await preloadImage(0);

    // Concurrently load the rest in batches of 14 for optimal network throughput
    const batchSize = 14;
    for (let i = 1; i < TOTAL_FRAMES; i += batchSize) {
      const batch = [];
      for (let j = i; j < i + batchSize && j < TOTAL_FRAMES; j++) {
        batch.push(preloadImage(j));
      }
      await Promise.all(batch);
    }
  }

  /* ==========================================================================
     PORTFOLIO COMPONENT INTERACTIONS
     ========================================================================== */

  // Active Navigation Link Highlighting on Scroll
  function updateActiveNavLink() {
    const scrollY = window.scrollY + 160;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollY >= top && scrollY < top + height) {
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }

  // Mobile Menu Toggle
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      const spans = mobileToggle.querySelectorAll('span');
      if (mobileMenu.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });

    // Close mobile menu on click link
    document.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        const spans = mobileToggle.querySelectorAll('span');
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      });
    });
  }

  // Testimonial Carousel Controls
  let testimonialIndex = 0;
  const testimonialCards = document.querySelectorAll('.testimonial-card');
  const totalTestimonials = testimonialCards.length;

  function updateTestimonialSlider() {
    if (window.innerWidth <= 900 && testimonialsTrack) {
      testimonialsTrack.style.transform = `translateX(-${testimonialIndex * 100}%)`;
    } else if (testimonialsTrack) {
      testimonialsTrack.style.transform = 'none';
    }
  }

  if (prevTestimonialBtn) {
    prevTestimonialBtn.addEventListener('click', () => {
      testimonialIndex = (testimonialIndex - 1 + totalTestimonials) % totalTestimonials;
      updateTestimonialSlider();
    });
  }

  if (nextTestimonialBtn) {
    nextTestimonialBtn.addEventListener('click', () => {
      testimonialIndex = (testimonialIndex + 1) % totalTestimonials;
      updateTestimonialSlider();
    });
  }

  // Contact Form Submission Handler
  window.handleFormSubmit = function() {
    const nameInput = document.getElementById('userName');
    const emailInput = document.getElementById('userEmail');
    const projectSelect = document.getElementById('projectType');
    const messageInput = document.getElementById('userMessage');
    const alertBox = document.getElementById('formAlert');
    const submitBtn = document.getElementById('submitBtn');

    if (!nameInput.value || !emailInput.value || !messageInput.value) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending Message...</span>';

    setTimeout(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Message Sent!</span> <svg class="icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
      
      alertBox.textContent = `Thank you, ${nameInput.value}! Your message has been received. Adeel will reach out shortly.`;
      alertBox.className = 'form-status-alert success';

      // Reset form fields
      nameInput.value = '';
      emailInput.value = '';
      projectSelect.selectedIndex = 0;
      messageInput.value = '';

      setTimeout(() => {
        submitBtn.innerHTML = '<span>Send Message</span> <svg class="icon-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
      }, 4000);
    }, 800);
  };

  // Download CV / Resume Feedback (allowing real native file download)
  const downloadCvBtn = document.getElementById('downloadCvBtn');
  if (downloadCvBtn) {
    downloadCvBtn.addEventListener('click', () => {
      const span = downloadCvBtn.querySelector('span');
      if (span) {
        const originalText = span.textContent;
        span.textContent = 'Downloading Resume...';
        
        setTimeout(() => {
          span.textContent = 'Resume Downloaded ✓';
          setTimeout(() => {
            span.textContent = originalText;
          }, 2500);
        }, 600);
      }
    });
  }

  /* ==========================================================================
     GLOBAL EVENT LISTENERS & INITIALIZATION
     ========================================================================== */
  window.addEventListener('scroll', () => {
    updateScrollTarget();
    updateActiveNavLink();
  }, { passive: true });

  window.addEventListener('resize', () => {
    resizeCanvas();
    updateTestimonialSlider();
  }, { passive: true });

  function init() {
    resizeCanvas();
    updateScrollTarget();
    updateActiveNavLink();
    startPreloading();
    animFrameId = requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
