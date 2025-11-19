import { prisma } from "./prisma";

export const getOrganizationIdByUserId = async (userId: string) => {
	const orgId = await prisma.organizationUser.findFirst({
		where: { userId },
		select: { organizationId: true },
	});
	if (!orgId) {
		throw new Error("Organization not found");
	}
	return orgId.organizationId;
};
