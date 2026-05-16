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



// what this fiel do ? - This file provides utility functions for managing authentication tokens in the frontend. It allows you to save, retrieve, and remove JWT tokens using cookies, as well as check if a user is authenticated based on the presence of a token.