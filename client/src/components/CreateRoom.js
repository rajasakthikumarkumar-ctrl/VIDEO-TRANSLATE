import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import './Form.css';

function CreateRoom() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    creatorName: '',
    creatorEmail: '',
    roomId: '',
    passcode: '',
    meetingDate: '',
    meetingTime: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const generateRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 10).toUpperCase();
    setFormData({
      ...formData,
      roomId: randomId
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    console.log('🏠 Creating room with API:', API_BASE);

    try {
      const response = await fetch(`${API_BASE}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Room created successfully');
        // Room created successfully, navigate to the room
        navigate(`/room/${formData.roomId}`, {
          state: {
            participantName: formData.creatorName,
            participantEmail: formData.creatorEmail,
            passcode: formData.passcode,
            isHost: true
          }
        });
      } else {
        console.error('❌ Room creation failed:', data.error);
        setError(data.error || 'Failed to create room');
      }
    } catch (error) {
      console.error('❌ Network error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-card">
        <h1>Create Room</h1>
        <p>Set up a new video meeting room</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="creatorName">Creator Name *</label>
            <input
              type="text"
              id="creatorName"
              name="creatorName"
              value={formData.creatorName}
              onChange={handleChange}
              required
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="creatorEmail">Creator Email *</label>
            <input
              type="email"
              id="creatorEmail"
              name="creatorEmail"
              value={formData.creatorEmail}
              onChange={handleChange}
              required
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomId">Room ID *</label>
            <div className="input-with-button">
              <input
                type="text"
                id="roomId"
                name="roomId"
                value={formData.roomId}
                onChange={handleChange}
                required
                placeholder="Enter unique room ID"
              />
              <button
                type="button"
                onClick={generateRoomId}
                className="btn btn-outline"
              >
                Generate
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="passcode">Room Passcode *</label>
            <input
              type="password"
              id="passcode"
              name="passcode"
              value={formData.passcode}
              onChange={handleChange}
              required
              placeholder="Enter room passcode"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="meetingDate">Meeting Date *</label>
              <input
                type="date"
                id="meetingDate"
                name="meetingDate"
                value={formData.meetingDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="meetingTime">Meeting Time *</label>
              <input
                type="time"
                id="meetingTime"
                name="meetingTime"
                value={formData.meetingTime}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRoom;