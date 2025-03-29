import {TOKEN_MISTRALAI} from './auth'; // Importer les fonctions d'authentification

export const callMistral = async (messages, model = "mistral-medium") => {
    try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN_MISTRALAI}`
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens: 10000
            })
        });

        const data = await response.json();
        return data.choices[0]?.message?.content.split('\n').map(line => line.trim()).filter(Boolean) || [];
    } catch (error) {
        console.error("❌ Mistral API error:", error);
        return [];
    }
};