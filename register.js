function registerUser(event) {
    event.preventDefault();

    let email = document.getElementById("regEmail").value;
    let pass = document.getElementById("regPass").value;
    let cpass = document.getElementById("regCPass").value;

    if (pass !== cpass) {
        alert("Passwords do not match!");
        return;
    }

    let users = JSON.parse(localStorage.getItem("users")) || [];

    // check duplicate email
    if (users.some(u => u.email === email)) {
        alert("User already exists!");
        return;
    }

    users.push({
        name: email.split("@")[0],  // default username
        email: email,
        password: pass
    });

    localStorage.setItem("users", JSON.stringify(users));

    alert("Registration Successful!");
    window.location.href = "login.html";
}

document.querySelector("form").addEventListener("submit", registerUser);
