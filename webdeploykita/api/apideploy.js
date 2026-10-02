export default async function handler(req, res) {

  // ==========================================
  // BASIC RESPONSE HEADERS
  // ==========================================

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept"
  );


  // ==========================================
  // PREFLIGHT
  // ==========================================

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }


  // ==========================================
  // HEALTH CHECK
  // GET /apideploy
  // ==========================================

  if (req.method === "GET") {

    const configured =
      Boolean(process.env.VERCEL_TOKEN);

    return res.status(200).json({

      ok: true,

      success: true,

      service:
        "WebDeployKita API",

      endpoint:
        "/apideploy",

      status:
        "online",

      provider:
        "Vercel",

      configured

    });

  }


  // ==========================================
  // POST ONLY FOR DEPLOYMENT
  // ==========================================

  if (req.method !== "POST") {

    return res.status(405).json({

      ok: false,

      success: false,

      error:
        "Method not allowed."

    });

  }


  // ==========================================
  // SERVER-SIDE VERCEL TOKEN
  // ==========================================

  const token =
    process.env.VERCEL_TOKEN;


  if (!token) {

    return res.status(500).json({

      ok: false,

      success: false,

      error:
        "VERCEL_TOKEN is not configured on the server.",

      code:
        "VERCEL_TOKEN_MISSING"

    });

  }


  try {

    // ========================================
    // READ REQUEST BODY
    // ========================================

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};


    const project =
      String(body.project || "").trim();

    const repo =
      String(body.repo || "").trim();

    const branch =
      String(body.branch || "main").trim() ||
      "main";


    // ========================================
    // VALIDATE PROJECT
    // ========================================

    if (!project) {

      return res.status(400).json({

        ok: false,

        success: false,

        error:
          "Project name is required.",

        code:
          "PROJECT_REQUIRED"

      });

    }


    // ========================================
    // VALIDATE REPOSITORY
    // ========================================

    if (!repo) {

      return res.status(400).json({

        ok: false,

        success: false,

        error:
          "Repository URL is required.",

        code:
          "REPOSITORY_REQUIRED"

      });

    }


    // ========================================
    // CLEAN GITHUB REPOSITORY
    // ========================================

    let cleanRepo =
      repo
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/^git@github\.com:/i, "")
        .replace(/^github\.com\//i, "")
        .replace(/\.git$/i, "")
        .replace(/\/+$/g, "")
        .trim();


    const parts =
      cleanRepo.split("/");


    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1]
    ) {

      return res.status(400).json({

        ok: false,

        success: false,

        error:
          "Invalid GitHub repository. Use format: https://github.com/owner/repository",

        code:
          "INVALID_REPOSITORY"

      });

    }


    const owner =
      parts[0];

    const repository =
      parts[1];


    // ========================================
    // SAFE VERCEL PROJECT NAME
    // ========================================

    const deploymentName =
      (project || repository)
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 52)
        || "webdeploykita-project";


    // ========================================
    // VERCEL DEPLOYMENT PAYLOAD
    // ========================================

    const deploymentPayload = {

      name:
        deploymentName,

      gitSource: {

        type:
          "github",

        org:
          owner,

        repo:
          repository,

        ref:
          branch

      }

    };


    // ========================================
    // VERCEL API ENDPOINT
    // ========================================

    const teamId =
      process.env.VERCEL_TEAM_ID;


    let endpoint =
      "https://api.vercel.com/v13/deployments";


    if (teamId) {

      endpoint +=
        "?teamId=" +
        encodeURIComponent(teamId);

    }


    // ========================================
    // SEND DEPLOYMENT TO VERCEL
    // ========================================

    const response =
      await fetch(
        endpoint,
        {

          method:
            "POST",

          headers: {

            "Authorization":
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify(
              deploymentPayload
            )

        }
      );


    // ========================================
    // READ VERCEL RESPONSE
    // ========================================

    const data =
      await response.json();


    // ========================================
    // VERCEL ERROR
    // ========================================

    if (!response.ok) {

      console.error(
        "Vercel deployment error:",
        data
      );


      return res.status(
        response.status
      ).json({

        ok: false,

        success: false,

        error:
          data?.error?.message ||
          data?.message ||
          "Vercel deployment failed.",

        code:
          data?.error?.code ||
          null

      });

    }


    // ========================================
    // NORMALIZE RESPONSE FOR FRONTEND
    // ========================================

    const deploymentId =
      data.id || null;


    const deploymentUrl =
      data.url
        ? `https://${data.url}`
        : null;


    const readyState =
      data.readyState ||
      "QUEUED";


    // ========================================
    // SUCCESS RESPONSE
    // ========================================

    return res.status(200).json({

      ok: true,

      success: true,

      message:
        "Deployment successfully created.",

      deploymentId,

      url:
        deploymentUrl,

      readyState,

      deployment: {

        id:
          deploymentId,

        name:
          data.name ||
          deploymentName,

        url:
          deploymentUrl,

        inspectorUrl:
          data.inspectorUrl ||
          null,

        readyState

      }

    });


  } catch (error) {

    console.error(
      "WebDeployKita API error:",
      error
    );


    return res.status(500).json({

      ok: false,

      success: false,

      error:
        "Internal server error.",

      message:
        error?.message ||
        "Unknown error"

    });

  }

}