import { initRouter } from './router.js';
import { supabase } from './services/supabaseClient.js';
import { setSession } from './state/session.js';

async function bootstrap() {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session) {
    setSession(session);
  }
  initRouter();
}

bootstrap();
