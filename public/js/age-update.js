function updateAge() {
    console.log("Age update function running");
    const birthDate = new Date('2008-05-02');
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    
    // Adjust age if birthday hasn't occurred this year
    if (today.getMonth() < birthDate.getMonth() || 
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    const ageElement = document.getElementById('age');
    if (ageElement) {
        ageElement.textContent = age;
    }
    
    // Update grade level
    const gradeElement = document.getElementById('grade');
    if (gradeElement) {
        console.log("Found grade element");
        const graduationYear = 2025;
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-11 (Jan-Dec)
        
        let grade = "Junior";
        
        // Only change to Senior if it's after August 2024
        if ((currentYear === 2025 && currentMonth >= 8) || currentYear >= 2025) {
            grade = "Senior";
        }
        
        console.log("Setting grade to:", grade);
        gradeElement.textContent = grade;
    }
}

// Update on page load
document.addEventListener('DOMContentLoaded', updateAge); 