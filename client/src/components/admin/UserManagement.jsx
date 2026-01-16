import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import './Management.css';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useAuth();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getUsers(token);
            setUsers(data);
            setFilteredUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUsers();
        }
    }, [token]);

    useEffect(() => {
        const results = users.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredUsers(results);
    }, [searchTerm, users]);

    const handleDelete = async (userId) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            try {
                await adminApi.deleteUser(userId, token);
                // Refresh the list after deleting
                const updatedUsers = users.filter(user => user.id !== userId);
                setUsers(updatedUsers);
                setFilteredUsers(updatedUsers.filter(user =>
                    user.username.toLowerCase().includes(searchTerm.toLowerCase())
                ));
            } catch (err) {
                setError(err.message);
            }
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await adminApi.updateUserRole(userId, newRole, token);
            // Refresh the list to show the new role
            fetchUsers();
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading users...</div>;
    if (error) return <div className="error-message">Error: {error}</div>;

    return (
        <div className="management-container">
            <h2>Zarządzanie użytkownikami</h2>
            
            <div className="search-bar" style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Szukaj użytkownika..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: '10px',
                        width: '100%',
                        maxWidth: '300px',
                        borderRadius: '5px',
                        border: '1px solid #444',
                        backgroundColor: '#222',
                        color: '#fff'
                    }}
                />
            </div>

            <table className="management-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Nazwa użytkownika</th>
                        <th>Email</th>
                        <th>Rola</th>
                        <th>Zarejestrowany od</th>
                        <th>Akcje</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredUsers.map(user => (
                        <tr key={user.id}>
                            <td>{user.id}</td>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            <td>
                                <select 
                                    value={user.role} 
                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                >
                                    <option value="USER">USER</option>
                                    <option value="ADMIN">ADMIN</option>
                                    <option value="EXPERT">EXPERT</option>
                                </select>
                            </td>
                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                            <td>
                                <button 
                                    className="btn-delete"
                                    onClick={() => handleDelete(user.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredUsers.length === 0 && (
                <p style={{ textAlign: 'center', marginTop: '20px', color: '#aaa' }}>Nie znaleziono użytkowników.</p>
            )}
        </div>
    );
};

export default UserManagement;
