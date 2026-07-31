import { apiRequest } from './client';

export const socialApi = {
  searchUsers: (token, q) =>
    apiRequest(`/social/users/search/?q=${encodeURIComponent(q)}`, { token }),

  getUserProfile: (token, userId) =>
    apiRequest(`/social/users/${userId}/`, { token }),

  nudgeFriend: (token, userId, clientDate) =>
    apiRequest(`/social/users/${userId}/nudge/`, {
      method: 'POST',
      token,
      body: clientDate ? { client_date: clientDate } : {},
    }),

  getFriends: (token, clientDate) => {
    const qs = clientDate ? `?client_date=${encodeURIComponent(clientDate)}` : '';
    return apiRequest(`/social/friends/${qs}`, { token });
  },

  getRequests: (token) =>
    apiRequest('/social/friends/requests/', { token }),

  sendRequest: (token, userId) =>
    apiRequest('/social/friends/requests/', {
      method: 'POST',
      token,
      body: { user_id: userId },
    }),

  acceptRequest: (token, requestId) =>
    apiRequest(`/social/friends/requests/${requestId}/accept/`, {
      method: 'POST',
      token,
    }),

  declineRequest: (token, requestId) =>
    apiRequest(`/social/friends/requests/${requestId}/decline/`, {
      method: 'POST',
      token,
    }),

  removeFriend: (token, userId) =>
    apiRequest(`/social/friends/${userId}/`, {
      method: 'DELETE',
      token,
    }),

  getGroups: (token) =>
    apiRequest('/social/groups/', { token }),

  createGroup: (token, { name, emoji, memberIds }) =>
    apiRequest('/social/groups/', {
      method: 'POST',
      token,
      body: { name, emoji, member_ids: memberIds },
    }),

  getGroup: (token, groupId) =>
    apiRequest(`/social/groups/${groupId}/`, { token }),

  addMembers: (token, groupId, userIds) =>
    apiRequest(`/social/groups/${groupId}/members/`, {
      method: 'POST',
      token,
      body: { user_ids: userIds },
    }),

  getGroupInvites: (token) =>
    apiRequest('/social/groups/invites/', { token }),

  acceptGroupInvite: (token, inviteId) =>
    apiRequest(`/social/groups/invites/${inviteId}/accept/`, {
      method: 'POST',
      token,
    }),

  declineGroupInvite: (token, inviteId) =>
    apiRequest(`/social/groups/invites/${inviteId}/decline/`, {
      method: 'POST',
      token,
    }),

  cancelGroupInvite: (token, groupId, inviteId) =>
    apiRequest(`/social/groups/${groupId}/invites/${inviteId}/`, {
      method: 'DELETE',
      token,
    }),

  leaveGroup: (token, groupId, userId) =>
    apiRequest(`/social/groups/${groupId}/members/${userId}/`, {
      method: 'DELETE',
      token,
    }),

  getChallenges: (token, groupId) =>
    apiRequest(`/social/groups/${groupId}/challenges/`, { token }),

  createChallenge: (token, groupId, { title, metric, target, startsAt, endsAt }) =>
    apiRequest(`/social/groups/${groupId}/challenges/`, {
      method: 'POST',
      token,
      body: { title, metric, target, starts_at: startsAt, ends_at: endsAt },
    }),

  getGroupLeaderboard: (token, groupId) =>
    apiRequest(`/social/groups/${groupId}/leaderboard/`, { token }),

  getChallengeLeaderboard: (token, challengeId) =>
    apiRequest(`/social/challenges/${challengeId}/leaderboard/`, { token }),
};
