const mongoose = require('mongoose');

const MONGO_URI = "mongodb+srv://sncckollam_db_user:u1F26vimHTZ9wYLe@cluster0.5qfiepf.mongodb.net/zoro_md?retryWrites=true&w=majority";

if (mongoose.connection.readyState === 0) {
    mongoose.connect(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log('✅ Connected to MongoDB successfully for ZORO-MD Menu!');
    }).catch(err => {
        console.error('❌ MongoDB Connection Error:', err);
    });
}

const menuSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, default: 'video' }
});

const MenuSettings = mongoose.model('MenuSettings', menuSettingsSchema);
module.exports = MenuSettings;
