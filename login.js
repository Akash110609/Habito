function loginUser(event) {
    event.preventDefault();

    let email = document.getElementById("loginEmail").value;
    let pass = document.getElementById("loginPassword").value;

    let users = JSON.parse(localStorage.getItem("users")) || [];

    let found = users.find(u => u.email === email && u.password === pass);

    if (found) {
        alert("Login Successful!");

        // ✔ earlier wrong (string save)
        // saving full user object
        localStorage.setItem("loggedInUser", JSON.stringify(found));

        window.location.href = "dashboard.html";
    } else {
        alert("Invalid Email or Password!");
    }
}

document.querySelector("form").addEventListener("submit", loginUser);
