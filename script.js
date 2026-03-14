// ===================================================
// TradeLiv — Lead Collection Landing Page
// Form Validation, Submission & UI Interactions
// ===================================================

// Mark body as JS-loaded immediately (enables reveal animations)
document.body.classList.add('js-loaded');

// Supabase client (keys loaded from config.js via index.html)
let supabaseClient = null;
try {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase client could not be initialized:', e);
}

// Script is at bottom of <body> — DOM is already ready, no DOMContentLoaded needed

// ---------- Navbar scroll effect ----------
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ---------- Smooth scroll for anchor links ----------
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ---------- Scroll-reveal animation ----------
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ---------- User type selector ----------
const typeOptions = document.querySelectorAll('.type-option');
let selectedUserType = '';

typeOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    typeOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedUserType = btn.dataset.type;
  });
});

// ---------- Form validation & submission ----------
const form = document.getElementById('leadForm');
const nameInput = document.getElementById('leadName');
const emailInput = document.getElementById('leadEmail');
const phoneInput = document.getElementById('leadPhone');
const submitBtn = document.getElementById('submitBtn');

// Layer 1 idempotency: check localStorage on load
const alreadyRegistered = localStorage.getItem('tradeliv-registered');
if (alreadyRegistered) {
  submitBtn.textContent = '✓ You\'re on the list!';
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  submitBtn.style.cursor = 'default';
}

// Validation helpers
const validators = {
  name: (val) => {
    if (!val.trim()) return 'Name is required';
    if (val.trim().length < 2) return 'Name must be at least 2 characters';
    return '';
  },
  email: (val) => {
    if (!val.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) return 'Please enter a valid email';
    return '';
  },
  phone: (val) => {
    if (!val.trim()) return 'Phone number is required';
    const digits = val.replace(/[\s\-\(\)\+]/g, '');
    if (digits.length < 10 || digits.length > 15) return 'Enter a valid phone number (10-15 digits)';
    if (!/^\d+$/.test(digits)) return 'Phone number must contain only digits';
    return '';
  }
};

function showFieldError(input, message) {
  input.classList.add('error');
  input.classList.remove('success');
  const errorEl = input.parentElement.querySelector('.form-error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

function clearFieldError(input) {
  input.classList.remove('error');
  const errorEl = input.parentElement.querySelector('.form-error');
  if (errorEl) {
    errorEl.classList.remove('show');
  }
}

function markFieldSuccess(input) {
  input.classList.remove('error');
  input.classList.add('success');
  clearFieldError(input);
}

// Live validation on blur
nameInput.addEventListener('blur', () => {
  const err = validators.name(nameInput.value);
  err ? showFieldError(nameInput, err) : markFieldSuccess(nameInput);
});

emailInput.addEventListener('blur', () => {
  const err = validators.email(emailInput.value);
  err ? showFieldError(emailInput, err) : markFieldSuccess(emailInput);
});

phoneInput.addEventListener('blur', () => {
  const err = validators.phone(phoneInput.value);
  err ? showFieldError(phoneInput, err) : markFieldSuccess(phoneInput);
});

// Clear error on input
[nameInput, emailInput, phoneInput].forEach(input => {
  input.addEventListener('input', () => clearFieldError(input));
});

// Form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nameErr = validators.name(nameInput.value);
  const emailErr = validators.email(emailInput.value);
  const phoneErr = validators.phone(phoneInput.value);

  let hasError = false;
  if (nameErr) { showFieldError(nameInput, nameErr); hasError = true; }
  else { markFieldSuccess(nameInput); }
  if (emailErr) { showFieldError(emailInput, emailErr); hasError = true; }
  else { markFieldSuccess(emailInput); }
  if (phoneErr) { showFieldError(phoneInput, phoneErr); hasError = true; }
  else { markFieldSuccess(phoneInput); }

  if (hasError) return;

  const leadData = {
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    user_type: selectedUserType || 'not_specified'
  };

  submitBtn.classList.add('loading');
  submitBtn.disabled = true;

  try {
    if (!supabaseClient) throw new Error('Supabase client not available. Check your network and config.js.');

    const { error } = await supabaseClient
      .from('leads')
      .insert([leadData]);

    if (error) throw error;

    // Success — set localStorage flag (Layer 1 idempotency)
    localStorage.setItem('tradeliv-registered', emailInput.value.trim());
    submitBtn.textContent = '✓ You\'re on the list!';
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'default';
    showToast('success', '🎉 Thank you! We\'ll reach out to you shortly.');

    form.reset();
    typeOptions.forEach(b => b.classList.remove('active'));
    selectedUserType = '';
    [nameInput, emailInput, phoneInput].forEach(input => input.classList.remove('success', 'error'));

  } catch (error) {
    // Layer 2 idempotency: Postgres unique violation on email
    if (error?.code === '23505') {
      showToast('info', '👋 You\'re already on our list. We\'ll be in touch!');
      localStorage.setItem('tradeliv-registered', emailInput.value.trim());
      submitBtn.textContent = '✓ You\'re on the list!';
      submitBtn.style.opacity = '0.7';
      submitBtn.style.cursor = 'default';
    } else {
      console.error('Supabase error:', error);
      showToast('error', 'Something went wrong. Please try again.');
    }
  } finally {
    submitBtn.classList.remove('loading');
    if (!localStorage.getItem('tradeliv-registered')) {
      submitBtn.disabled = false;
    }
  }
});

// ---------- Toast notifications ----------
function showToast(type, message) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'info' ? '👋' : '✕'}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ---------- Phone input formatting ----------
phoneInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/[^\d\s\-\(\)\+]/g, '');
});
