// ===================================================
// TradeLiv — Lead Collection Landing Page
// Form Validation, Submission & UI Interactions
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Theme toggle ----------
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const root = document.documentElement;

  // Load saved theme or default to dark
  const savedTheme = localStorage.getItem('tradeliv-theme') || 'dark';
  root.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';

  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    themeIcon.textContent = next === 'light' ? '🌙' : '☀️';
    localStorage.setItem('tradeliv-theme', next);
  });

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
        const offset = 80; // navbar height
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

    // Validate all fields
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

    // Prepare data
    const leadData = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      userType: selectedUserType || 'not_specified',
      submittedAt: new Date().toISOString()
    };

    // Show loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      // ─────────────────────────────────────────────
      // PLACEHOLDER: Replace with your actual API endpoint
      // e.g., Supabase, Firebase, Express backend, etc.
      //
      // Example with Supabase:
      //   const { data, error } = await supabase
      //     .from('leads')
      //     .insert([leadData]);
      //
      // Example with a REST API:
      //   const res = await fetch('https://your-api.com/leads', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(leadData)
      //   });
      // ─────────────────────────────────────────────

      // Simulate network delay for now
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Log data to console (for development)
      console.log('Lead captured:', leadData);

      // Success!
      showToast('success', '🎉 Thank you! We\'ll reach out to you shortly.');

      // Reset form
      form.reset();
      typeOptions.forEach(b => b.classList.remove('active'));
      selectedUserType = '';
      [nameInput, emailInput, phoneInput].forEach(input => {
        input.classList.remove('success', 'error');
      });

    } catch (error) {
      console.error('Submission error:', error);
      showToast('error', 'Something went wrong. Please try again.');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // ---------- Toast notifications ----------
  function showToast(type, message) {
    // Remove any existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '✕'}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ---------- Phone input formatting ----------
  phoneInput.addEventListener('input', (e) => {
    // Allow only digits, spaces, hyphens, parens, plus
    e.target.value = e.target.value.replace(/[^\d\s\-\(\)\+]/g, '');
  });
});
