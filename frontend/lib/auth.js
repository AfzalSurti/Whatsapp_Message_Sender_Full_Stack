import Cookies from 'js-cookie';

// Save token after login/signup
export const saveToken = (token) => {
  Cookies.set('token', token, { expires: 7 }); // 7 days
};

// Get token
export const getToken = () => {
  return Cookies.get('token');
};

// Remove token on logout
export const removeToken = () => {
  Cookies.remove('token');
};

// Check if logged in
export const isAuthenticated = () => {
  return !!Cookies.get('token'); // Returns true if token exists
};


// what commit i do for thsi file ?You can use the following commit message for the changes made in this file: - "Add auth utility functions for token management in frontend"