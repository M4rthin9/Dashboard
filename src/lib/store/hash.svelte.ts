export const hashState = $state({ value: location.hash });

window.addEventListener('hashchange', () => {
  hashState.value = location.hash;
});
