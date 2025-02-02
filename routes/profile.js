const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const fs = require('fs').promises;
const path = require('path');

// Add this route handler
router.post('/reset-picture', auth, async (req, res) => {
    try {
        const user = req.user;
        
        // If user has a profile picture
        if (user.profilePicture) {
            // Get the absolute file path from the public directory
            const filePath = path.join(__dirname, '..', 'public', 'uploads', 'profiles', 
                path.basename(user.profilePicture));
            
            try {
                // Delete the file
                await fs.unlink(filePath);
                console.log('File deleted successfully:', filePath);
            } catch (error) {
                console.error('Error deleting file:', error);
                // Continue even if file deletion fails
            }

            // Update user in database
            user.profilePicture = null;
            await user.save();
        }

        res.json({ message: 'Profile picture reset successfully' });
    } catch (error) {
        console.error('Error resetting profile picture:', error);
        res.status(500).json({ error: 'Error resetting profile picture' });
    }
}); 