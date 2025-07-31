<script>
  import { goto } from '$app/navigation';
  
  let password = '';
  let error = '';
  
  async function login() {
    const resp = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    if (resp.ok) {
      goto('/');
    } else {
      error = 'Invalid password';
    }
  }
</script>

<div class="login-container">
  <div class="login-card">
    <h1>🔒 SEO Tracker</h1>
    <p>Enter team password to access</p>
    
    <form on:submit|preventDefault={login}>
      <input 
        type="password" 
        bind:value={password} 
        placeholder="Team password..."
        required
      />
      <button type="submit">Login</button>
    </form>
    
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #55c39f, #676fff);
    font-family: 'Raleway', sans-serif;
  }
  
  .login-card {
    background: white;
    padding: 3em;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    text-align: center;
    min-width: 350px;
  }
  
  h1 {
    color: #333;
    margin-bottom: 0.5em;
  }
  
  p {
    color: #666;
    margin-bottom: 2em;
  }
  
  input {
    width: 100%;
    padding: 1em;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1em;
    margin-bottom: 1.5em;
    box-sizing: border-box;
  }
  
  input:focus {
    outline: none;
    border-color: #55c39f;
  }
  
  button {
    width: 100%;
    padding: 1em;
    background: #55c39f;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1em;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  button:hover {
    background: #4ab396;
  }
  
  .error {
    color: #d66f8d;
    font-weight: bold;
    margin-top: 1em;
  }
</style>