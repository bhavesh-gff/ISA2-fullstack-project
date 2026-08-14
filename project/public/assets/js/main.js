document.addEventListener("DOMContentLoaded", function () {
  // 1. NAVBAR SCROLL EFFECT (Optimized with Passive Listener)
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    window.addEventListener(
      "scroll",
      () => {
        if (window.scrollY > 50) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      },
      { passive: true },
    );
  }

  // 2. SCROLL REVEAL ANIMATIONS
  const revealElements = document.querySelectorAll(".reveal");
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const revealPoint = 100;

    revealElements.forEach((el) => {
      const revealTop = el.getBoundingClientRect().top;
      if (revealTop < windowHeight - revealPoint) {
        el.classList.add("active");
      }
    });
  };

  if (revealElements.length > 0) {
    window.addEventListener("scroll", revealOnScroll, { passive: true });
    revealOnScroll();
  }

  // ----------------------------------------------------
  // 3. HELPER FUNCTIONS (Bootstrap-aligned Messages & Spinner)
  // ----------------------------------------------------
  function showFormMessage(formEl, message, type = "success") {
    if (!formEl) return;

    let existingMsg = formEl.querySelector(".form-status-message");
    if (existingMsg) existingMsg.remove();

    const msgEl = document.createElement("div");
    const alertType = type === "success" ? "alert-success" : "alert-danger";
    msgEl.className = `form-status-message alert ${alertType} mt-3 mb-0 text-center py-2`;
    msgEl.role = "alert";
    msgEl.textContent = message;

    formEl.appendChild(msgEl);

    setTimeout(() => {
      if (msgEl) msgEl.remove();
    }, 5000);
  }

  function setButtonLoading(button, isLoading, loadingText = "Submitting...") {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
      button.disabled = true;
    } else {
      button.innerHTML = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  // ----------------------------------------------------
  // 4. BOOKING FORM SUBMISSION
  // ----------------------------------------------------
  const bookingForm = document.getElementById("bookingForm");

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = bookingForm.querySelector('button[type="submit"]');

      const nameField =
        bookingForm.querySelector("#name") ||
        bookingForm.querySelector('[name="name"]');
      const phoneField =
        bookingForm.querySelector("#phone") ||
        bookingForm.querySelector('[name="phone"]') ||
        bookingForm.querySelector('[name="mobile"]');
      const serviceField =
        bookingForm.querySelector("#service") ||
        bookingForm.querySelector('[name="service"]');
      const specialistField =
        bookingForm.querySelector("#specialist") ||
        bookingForm.querySelector('[name="specialist"]');
      const dateField =
        bookingForm.querySelector("#date") ||
        bookingForm.querySelector('[name="date"]');
      const timeField =
        bookingForm.querySelector("#time") ||
        bookingForm.querySelector('[name="time"]');

      const payload = {
        name: nameField?.value?.trim() || "",
        phone: phoneField?.value?.trim() || "",
        service: serviceField?.value || "",
        specialist: specialistField?.value || "",
        date: dateField?.value || "",
        time: timeField?.value || "",
      };

      if (
        !payload.name ||
        !payload.phone ||
        !payload.service ||
        !payload.date ||
        !payload.time
      ) {
        showFormMessage(
          bookingForm,
          "Please fill in all required fields.",
          "error",
        );
        return;
      }

      setButtonLoading(submitBtn, true, "Booking...");

      try {
        const response = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success !== false) {
          showFormMessage(
            bookingForm,
            result.message || "Appointment booked successfully!",
            "success",
          );
          bookingForm.reset();
        } else {
          showFormMessage(
            bookingForm,
            result.message || "Something went wrong. Please try again.",
            "error",
          );
        }
      } catch (error) {
        console.error("Booking request failed:", error);
        showFormMessage(
          bookingForm,
          "Network error. Please make sure the server is reachable.",
          "error",
        );
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }

  // ----------------------------------------------------
  // 5. CONTACT FORM SUBMISSION
  // ----------------------------------------------------
  const contactForm = document.getElementById("contactForm");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = contactForm.querySelector('button[type="submit"]');

      const nameField =
        contactForm.querySelector("#name") ||
        contactForm.querySelector("#contactName") ||
        contactForm.querySelector('[name="name"]');
      const emailField =
        contactForm.querySelector("#email") ||
        contactForm.querySelector("#contactEmail") ||
        contactForm.querySelector('[name="email"]');
      const subjectField =
        contactForm.querySelector("#subject") ||
        contactForm.querySelector("#contactSubject") ||
        contactForm.querySelector('[name="subject"]');
      const messageField =
        contactForm.querySelector("#message") ||
        contactForm.querySelector("#contactMessage") ||
        contactForm.querySelector('[name="message"]');

      const payload = {
        name: nameField?.value?.trim() || "",
        email: emailField?.value?.trim() || "",
        subject: subjectField?.value?.trim() || "",
        message: messageField?.value?.trim() || "",
      };

      if (!payload.name || !payload.email || !payload.message) {
        showFormMessage(
          contactForm,
          "Please fill in all required fields.",
          "error",
        );
        return;
      }

      setButtonLoading(submitBtn, true, "Sending...");

      try {
        const response = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok && result.success !== false) {
          showFormMessage(
            contactForm,
            result.message || "Message sent successfully!",
            "success",
          );
          contactForm.reset();
        } else {
          showFormMessage(
            contactForm,
            result.message || "Something went wrong. Please try again.",
            "error",
          );
        }
      } catch (error) {
        console.error("Contact request failed:", error);
        showFormMessage(
          contactForm,
          "Network error. Please make sure the server is reachable.",
          "error",
        );
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });
  }
});
