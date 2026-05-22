const API_BASE = '';
let cart = JSON.parse(localStorage.getItem('vanilkaCart')) || [];

// ===== HEADER SCROLL =====
window.addEventListener('scroll', () => {
  document.getElementById('header').classList.toggle('scrolled', window.scrollY > 10);
});

// ===== BURGER / MOBILE NAV =====
const burger = document.getElementById('burger');
const mobileNav = document.getElementById('mobile-nav');

burger.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
});

document.querySelectorAll('.m-nav-link').forEach(link => {
  link.addEventListener('click', () => mobileNav.classList.remove('open'));
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    const offset = document.getElementById('header').offsetHeight;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    mobileNav.classList.remove('open');
  });
});

// ===== CART =====
function openCart() {
  document.getElementById('cart-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCart();
}
function closeCart() {
  document.getElementById('cart-modal').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('cart-icon').addEventListener('click', openCart);
document.getElementById('close-cart').addEventListener('click', closeCart);
document.getElementById('cart-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('cart-modal')) closeCart();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

function saveCart() { localStorage.setItem('vanilkaCart', JSON.stringify(cart)); }

function renderCart() {
  const body = document.getElementById('cart-items');
  const counter = document.getElementById('cart-counter');
  const total = document.getElementById('cart-total');

  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  counter.textContent = totalQty;
  counter.style.display = totalQty > 0 ? 'flex' : 'none';
  total.textContent = totalPrice.toLocaleString('ru-RU');

  if (cart.length === 0) {
    body.innerHTML = `<div class="cart-empty"><i class="fas fa-shopping-bag"></i><p>Корзина пуста</p></div>`;
    return;
  }

  const imgMap = {
    1:'tort_klubnichny.jpg',2:'tort_shokoladny.jpg',3:'tort_medovy.jpg',4:'tort_karandash.jpg',
    5:'makarun_assorti.jpg',6:'makarun_fistashka.jpg',7:'makarun_shokolad.jpg',8:'makarun_yagody.jpg',
    9:'kapkeik_vanil.jpg',10:'kapkeik_shokolad.jpg',11:'kapkeik_krasny.jpg',12:'kapkeik_kokos.jpg',
    13:'ekler_shokolad.jpg',14:'ekler_vanil.jpg',15:'ekler_kofe.jpg',16:'ekler_yagoda.jpg',
    17:'chizkeik_nyu_york.jpg',18:'chizkeik_shokolad.jpg',19:'chizkeik_yagodny.jpg',20:'chizkeik_karamel.jpg'
  };

  body.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-img" style="background-image:url('${imgMap[item.id] || ''}')"></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">${(item.price * item.quantity).toLocaleString('ru-RU')} ₽</div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-idx="${idx}">−</button>
          <span class="qty-val">${item.quantity}</span>
          <button class="qty-btn" data-action="inc" data-idx="${idx}">+</button>
          <button class="remove-btn" data-action="remove" data-idx="${idx}"><i class="fas fa-trash-alt"></i></button>
        </div>
      </div>
    </div>`).join('');

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'inc') cart[idx].quantity++;
      else if (action === 'dec') { cart[idx].quantity--; if (cart[idx].quantity < 1) cart.splice(idx, 1); }
      else if (action === 'remove') cart.splice(idx, 1);
      saveCart(); renderCart();
    });
  });
}

function addToCart(id, name, price) {
  const existing = cart.find(i => i.id == id);
  if (existing) existing.quantity++;
  else cart.push({ id: parseInt(id), name, price: parseInt(price), quantity: 1 });
  saveCart(); renderCart();
  showToast(`«${name}» добавлен в корзину`, 'success');
}

document.querySelectorAll('.add-to-cart').forEach(btn => {
  btn.addEventListener('click', () => {
    addToCart(btn.dataset.id, btn.dataset.name, btn.dataset.price);
  });
});

// Checkout button → scroll to form
document.getElementById('checkout-btn').addEventListener('click', () => {
  if (cart.length === 0) { showToast('Корзина пуста', 'error'); return; }
  closeCart();
  setTimeout(() => {
    const section = document.getElementById('contacts');
    const offset = document.getElementById('header').offsetHeight;
    window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    setTimeout(() => {
      const msg = document.getElementById('message');
      let text = 'ХОЧУ ЗАКАЗАТЬ:\n\n';
      cart.forEach(i => { text += `— ${i.name} × ${i.quantity} шт.\n`; });
      text += `\nСумма: ${cart.reduce((s,i)=>s+i.price*i.quantity,0).toLocaleString('ru-RU')} ₽`;
      msg.value = text; msg.focus();
    }, 600);
  }, 350);
});

// ===== FILTER =====
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.product-card').forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
});

// ===== SCROLL ANIMATION =====
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.product-card').forEach(c => observer.observe(c));

// ===== ORDER FORM =====
document.getElementById('orderForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const message = document.getElementById('message').value.trim();

  if (!name || !phone || !email || !message) {
    showToast('Заполните все обязательные поля', 'error'); return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  let orderMessage = message;
  if (cart.length > 0) {
    orderMessage += '\n\n— Товары из корзины —\n';
    cart.forEach(i => { orderMessage += `• ${i.name} × ${i.quantity} = ${(i.price*i.quantity).toLocaleString('ru-RU')} ₽\n`; });
    orderMessage += `Итого: ${total.toLocaleString('ru-RU')} ₽`;
  }

  const btn = this.querySelector('button[type="submit"]');
  btn.textContent = 'Отправка...'; btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_name: name, customer_phone: phone, customer_email: email, total, message: orderMessage })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Спасибо, ${name}! Заказ №${data.orderId} принят. Свяжемся в течение часа.`, 'success');
      this.reset(); cart = []; saveCart(); renderCart();
    } else throw new Error(data.error || 'Ошибка');
  } catch(err) {
    showToast('Ошибка отправки. Позвоните нам напрямую.', 'error');
  } finally {
    btn.textContent = 'Отправить заказ'; btn.disabled = false;
  }
});

// Phone mask
document.getElementById('phone').addEventListener('input', function() {
  let v = this.value.replace(/\D/g, '');
  if (!v) return;
  if (v[0] !== '7') v = '7' + v;
  let r = '+7';
  if (v.length > 1) r += ' (' + v.substring(1, 4);
  if (v.length >= 4) r += ') ' + v.substring(4, 7);
  if (v.length >= 7) r += '-' + v.substring(7, 9);
  if (v.length >= 9) r += '-' + v.substring(9, 11);
  this.value = r;
});

// ===== TOAST =====
let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3500);
}

// ===== ADMIN LINK =====
document.getElementById('admin-link').addEventListener('click', e => {
  e.preventDefault();
  window.open('admin.html', '_blank');
});

// Init
renderCart();
