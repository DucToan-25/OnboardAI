
const cancelBtn = document.getElementById("cancelBtn");
const discardBtn = document.getElementById("discardBtn");
const closeBtn = document.getElementById("closeBtn");
const modal = document.getElementById("myModal");
const toast = document.getElementById("toast");

let toastTimer;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(function () {
        toast.classList.remove("show");
    }, 3000);
}
function closeModal(message) {
    modal.style.display = "none";
    showToast(message);
}

cancelBtn.addEventListener("click", function () {
    showToast("Bạn có thể tiếp tục chỉnh sửa.");
});

discardBtn.addEventListener("click", function () {
    closeModal("Đã loại bỏ nội dung chưa được lưu.");
});

closeBtn.addEventListener("click", function () {
    closeModal("Nội dung chỉnh sửa vẫn được giữ lại.");
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" &&
        modal.style.display !== "none") {

        closeModal("Nội dung chỉnh sửa vẫn được giữ lại.");
    }
});
