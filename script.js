document.addEventListener('DOMContentLoaded', function () {
  var forms = document.querySelectorAll('form');
  forms.forEach(function (form) {
    var isRegister = form.querySelector('#confirmPassword') !== null;
    var isForgot = form.querySelector('#email') && !form.querySelector('#password') && !form.querySelector('#username');
    var isLogin = !isRegister && !isForgot && form.querySelector('#username') && form.querySelector('#password');

    if (isRegister) {
      var pwd = form.querySelector('#password');
      var cpwd = form.querySelector('#confirmPassword');
      var fullname = form.querySelector('#fullname');
      var email = form.querySelector('#email');
      var username = form.querySelector('#username');
      var msg = document.createElement('div');
      msg.className = 'form-feedback';
      form.appendChild(msg);

      function validatePasswords() {
        var mismatch = pwd.value !== cpwd.value;
        if (mismatch) {
          cpwd.setCustomValidity('Passwords do not match');
        } else {
          cpwd.setCustomValidity('');
        }
        return !mismatch;
      }

      pwd.addEventListener('input', validatePasswords);
      cpwd.addEventListener('input', validatePasswords);

      form.addEventListener('submit', function (e) {
        var ok = validatePasswords();
        if (!ok) {
          e.preventDefault();
          cpwd.reportValidity();
          return;
        }
        // Save user to localStorage for admin tracking
        e.preventDefault();
        var users = [];
        try {
          users = JSON.parse(localStorage.getItem('users') || '[]');
        } catch (err) {
          users = [];
        }
        var uname = username ? username.value.trim() : '';
        if (uname && users.some(function(u){ return (u.username || '') === uname; })) {
          msg.textContent = 'Username already exists. Please choose another.';
          msg.classList.remove('success');
          msg.classList.add('error');
          return;
        }
        var newUser = {
          id: Date.now(),
          fullname: fullname ? fullname.value.trim() : '',
          email: email ? email.value.trim() : '',
          username: uname,
          password: pwd ? pwd.value : '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        msg.textContent = 'Registration submitted! Awaiting admin approval.';
        msg.classList.remove('error');
        msg.classList.add('success');
        form.reset();
      });
    }

    if (isForgot) {
      var email = form.querySelector('#email');
      var btn = form.querySelector('button[type="submit"]');
      var msg = document.createElement('div');
      msg.className = 'form-feedback';
      form.appendChild(msg);

      form.addEventListener('submit', function (e) {
        if (!email.checkValidity()) {
          e.preventDefault();
          email.reportValidity();
          return;
        }
        e.preventDefault();
        msg.textContent = 'If an account exists for ' + email.value + ', a reset link has been sent.';
        msg.classList.remove('error');
        msg.classList.add('success');
        btn.disabled = true;
        btn.textContent = 'Link Sent';
      });
    }

    if (isLogin) {
      var userInput = form.querySelector('#username');
      var passInput = form.querySelector('#password');
      var msg = document.createElement('div');
      msg.className = 'form-feedback';
      form.appendChild(msg);

      form.addEventListener('submit', function (e) {
        if (!form.checkValidity()) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        var users;
        try {
          users = JSON.parse(localStorage.getItem('users') || '[]');
        } catch (e2) {
          users = [];
        }
        var uname = (userInput.value || '').trim();
        var pass = passInput.value || '';
        var user = users.find(function(u){ return (u.username || '') === uname; });
        if (!user) {
          msg.textContent = 'Invalid username or password';
          msg.classList.remove('success');
          msg.classList.add('error');
          return;
        }
        if ((user.password || '') !== pass) {
          msg.textContent = 'Invalid username or password';
          msg.classList.remove('success');
          msg.classList.add('error');
          return;
        }
        if (user.status === 'pending') {
          msg.textContent = 'Your account is pending approval';
          msg.classList.remove('success');
          msg.classList.add('error');
          return;
        }
        if (user.status === 'rejected') {
          msg.textContent = 'Your account has been rejected';
          msg.classList.remove('success');
          msg.classList.add('error');
          return;
        }
        msg.textContent = 'Login successful';
        msg.classList.remove('error');
        msg.classList.add('success');
        sessionStorage.setItem('currentUser', JSON.stringify({ id: user.id, username: user.username, fullname: user.fullname }));
      });
    }
  });

  // Admin page logic
  var usersTable = document.getElementById('usersTable');
  if (usersTable) {
    // Simple access guard: require admin session
    if (sessionStorage.getItem('isAdmin') !== 'true') {
      window.location.href = 'admin-login.html';
      return;
    }
    var statsEl = document.getElementById('adminStats');

    function loadUsers() {
      try {
        return JSON.parse(localStorage.getItem('users') || '[]');
      } catch (e) {
        return [];
      }
    }

    function saveUsers(list) {
      localStorage.setItem('users', JSON.stringify(list));
    }

    function render() {
      var users = loadUsers();
      var tbody = usersTable.querySelector('tbody');
      tbody.innerHTML = '';
      users.forEach(function (u, index) {
        var tr = document.createElement('tr');
        var statusClass = 'pending';
        if (u.status === 'approved') statusClass = 'approved';
        if (u.status === 'rejected') statusClass = 'rejected';

        tr.innerHTML = `
          <td>${u.fullname || '-'}</td>
          <td>${u.email || '-'}</td>
          <td>${u.username || '-'}</td>
          <td><span class="status-badge ${statusClass}">${u.status}</span></td>
          <td>
            <button class="action-btn approve" data-idx="${index}">Approve</button>
            <button class="action-btn reject" data-idx="${index}">Reject</button>
          </td>`;
        tbody.appendChild(tr);
      });

      var counts = users.reduce(function (acc, u) {
        acc.total++;
        acc[u.status] = (acc[u.status] || 0) + 1;
        return acc;
      }, { total: 0, pending: 0, approved: 0, rejected: 0 });

      if (statsEl) {
        statsEl.innerHTML =
          '<div class="stat">Total: <strong>' + counts.total + '</strong></div>' +
          '<div class="stat">Pending: <strong>' + counts.pending + '</strong></div>' +
          '<div class="stat">Approved: <strong>' + counts.approved + '</strong></div>' +
          '<div class="stat">Rejected: <strong>' + counts.rejected + '</strong></div>';
      }

      // Wire up buttons
      usersTable.querySelectorAll('.action-btn.approve').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var list = loadUsers();
          if (list[idx]) {
            list[idx].status = 'approved';
            saveUsers(list);
            render();
          }
        });
      });
      usersTable.querySelectorAll('.action-btn.reject').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          var list = loadUsers();
          if (list[idx]) {
            list[idx].status = 'rejected';
            saveUsers(list);
            render();
          }
        });
      });
    }

    render();
  }

  // Admin login page logic
  var adminLoginForm = document.getElementById('adminLogin');
  if (adminLoginForm) {
    var adminUserInput = document.getElementById('adminUsername');
    var adminPassInput = document.getElementById('adminPassword');
    var msg = document.createElement('div');
    msg.className = 'form-feedback';
    adminLoginForm.appendChild(msg);

    var DEFAULT_ADMIN_USER = 'admin';
    var DEFAULT_ADMIN_PASS = 'admin@123';

    adminLoginForm.addEventListener('submit', function (e) {
      if (!adminLoginForm.checkValidity()) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      var u = (adminUserInput.value || '').trim();
      var p = (adminPassInput.value || '').trim();
      if (u === DEFAULT_ADMIN_USER && p === DEFAULT_ADMIN_PASS) {
        sessionStorage.setItem('isAdmin', 'true');
        msg.textContent = 'Login successful. Redirecting...';
        msg.classList.remove('error');
        msg.classList.add('success');
        setTimeout(function(){ window.location.href = 'admin.html'; }, 400);
      } else {
        msg.textContent = 'Invalid admin credentials';
        msg.classList.remove('success');
        msg.classList.add('error');
      }
    });
  }
});
