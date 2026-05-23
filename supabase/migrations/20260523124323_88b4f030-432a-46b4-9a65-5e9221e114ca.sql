-- Table de heartbeat de l'agent d'impression local
CREATE TABLE public.agent_status (
  id text PRIMARY KEY DEFAULT 'print-agent',
  user_id uuid NOT NULL,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'online',
  printer_ip text
);

-- Active la sécurité ligne par ligne (RLS)
ALTER TABLE public.agent_status ENABLE ROW LEVEL SECURITY;

-- Politique : l'utilisateur connecté ne voit que son propre agent
CREATE POLICY "Users can view their own agent status"
  ON public.agent_status
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique : l'utilisateur connecté peut mettre à jour son propre agent
CREATE POLICY "Users can update their own agent status"
  ON public.agent_status
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique : l'utilisateur connecté peut insérer son propre agent
CREATE POLICY "Users can insert their own agent status"
  ON public.agent_status
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Index pour accélérer les recherches par utilisateur
CREATE INDEX idx_agent_status_user_id ON public.agent_status(user_id);
